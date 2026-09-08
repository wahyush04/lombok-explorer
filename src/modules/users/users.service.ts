import bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/app-error';
import { isReservedUsername } from '../../common/validators/username.validator';
import { logger } from '../../common/utils/logger';
import { cloudinaryService } from '../cloudinary/cloudinary.service';
import { SanitizedUser } from '../auth/dto/auth.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user.dto';
import { usersRepository, UsersRepository } from './users.repository';

export class UsersService {
  private readonly saltRounds = 12;

  constructor(private readonly repository: UsersRepository = usersRepository) {}

  public sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      shortBio: user.shortBio ?? null,
      avatarUrl: user.avatarUrl,
      avatarPublicId: user.avatarPublicId ?? null,
      phone: user.phone,
      role: user.role,
      travelStyle: user.travelStyle,
      preferredRegion: user.preferredRegion,
      isEmailVerified: user.isEmailVerified,
      hasPassword: Boolean(user.password && user.password.length > 0),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public async checkUsername(
    username: string,
  ): Promise<{ username: string; available: boolean; reason?: 'TAKEN' | 'RESERVED' }> {
    const normalized = username.toLowerCase().trim();
    if (isReservedUsername(normalized)) {
      return {
        username: normalized,
        available: false,
        reason: 'RESERVED',
      };
    }
    const existing = await this.repository.findByUsername(normalized);
    if (existing) {
      return {
        username: normalized,
        available: false,
        reason: 'TAKEN',
      };
    }
    return {
      username: normalized,
      available: true,
    };
  }

  public async getProfile(userId: string): Promise<SanitizedUser> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return this.sanitizeUser(user);
  }

  public async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SanitizedUser> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const updateData: Prisma.UserUpdateInput = {};

    // Support name or fullName alias
    const resolvedName = dto.fullName ?? dto.name;
    if (resolvedName !== undefined) {
      updateData.name = resolvedName.trim();
    }

    // Support shortBio or bio alias
    const resolvedBio = dto.shortBio ?? dto.bio;
    if (resolvedBio !== undefined) {
      updateData.shortBio = resolvedBio ? resolvedBio.trim() : null;
    }

    // Support phone or phoneNumber alias
    const resolvedPhone = dto.phoneNumber ?? dto.phone;
    if (resolvedPhone !== undefined) {
      updateData.phone = resolvedPhone ? resolvedPhone.trim() : null;
    }

    if (dto.travelStyle !== undefined) {
      updateData.travelStyle = dto.travelStyle;
    }
    if (dto.preferredRegion !== undefined) {
      updateData.preferredRegion = dto.preferredRegion;
    }

    // Handle Cloudinary avatarPublicId and avatarUrl
    let oldAvatarPublicIdToDelete: string | null = null;
    if (dto.avatarPublicId !== undefined) {
      const publicId = dto.avatarPublicId ? dto.avatarPublicId.trim() : null;
      if (publicId) {
        // Validate Cloudinary asset ownership
        cloudinaryService.validateAssetOwnership(publicId, userId, 'any');
        updateData.avatarPublicId = publicId;
      } else {
        updateData.avatarPublicId = null;
      }

      if (user.avatarPublicId && user.avatarPublicId !== publicId) {
        oldAvatarPublicIdToDelete = user.avatarPublicId;
      }
    }

    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl ? dto.avatarUrl.trim() : null;
    }

    // Handle username update with collision detection
    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.toLowerCase().trim();
      if (normalizedUsername !== user.username) {
        const existing = await this.repository.findByUsernameExcludingUser(
          normalizedUsername,
          userId,
        );
        if (existing) {
          throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
        }
        updateData.username = normalizedUsername;
      }
    }

    try {
      const updatedUser = await this.repository.updateProfile(userId, updateData);

      // Post-commit: cleanup old avatar from Cloudinary safely
      if (oldAvatarPublicIdToDelete) {
        cloudinaryService.deleteAsset(oldAvatarPublicIdToDelete).catch((err) => {
          logger.warn(
            { err, oldPublicId: oldAvatarPublicIdToDelete },
            'Failed to delete previous avatar from Cloudinary during profile update',
          );
        });
      }

      return this.sanitizeUser(updatedUser);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String((err.meta as { target?: string[] | string })?.target || '');
        if (target.includes('username')) {
          throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
        }
      }
      throw err;
    }
  }

  public async uploadAvatar(
    userId: string,
    file: import('../storage/providers').UploadFileInput,
  ): Promise<SanitizedUser> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const { storageService } = await import('../storage/storage.service');
    const oldPublicId = user.avatarPublicId || user.avatarUrl || '';
    const storedMedia = await storageService.replaceImage(oldPublicId, file, {
      type: 'PROFILE',
      entityId: userId,
    });

    const updatedUser = await this.repository.updateProfile(userId, {
      avatarUrl: storedMedia.secureUrl,
      avatarPublicId: storedMedia.publicId,
    });

    return this.sanitizeUser(updatedUser);
  }

  public async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const hasExistingPassword = Boolean(user.password && user.password.length > 0);

    if (hasExistingPassword) {
      if (!dto.currentPassword || dto.currentPassword.trim().length === 0) {
        throw new BadRequestError('Current password is required', 'INVALID_CURRENT_PASSWORD');
      }

      const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password!);
      if (!isCurrentValid) {
        throw new BadRequestError(
          'The current password you provided is incorrect',
          'INVALID_CURRENT_PASSWORD',
        );
      }

      if (dto.newPassword === dto.currentPassword) {
        throw new BadRequestError(
          'New password cannot be the same as your current password',
          'SAME_PASSWORD',
        );
      }
    }

    // Hash new password using existing 12-round bcrypt standard
    const hashedPassword = await bcrypt.hash(dto.newPassword, this.saltRounds);

    // Update password and invalidate refresh token sessions
    await this.repository.updatePassword(userId, hashedPassword);
  }

  public async deleteAccount(userId: string): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // 1. Soft-delete user, clear refresh tokens, deactivate device tokens, and soft-delete active posts
    await this.repository.softDeleteUser(userId);

    // 2. Safely cleanup Cloudinary avatar asset post-commit
    if (user.avatarPublicId) {
      cloudinaryService.deleteAsset(user.avatarPublicId).catch((err) => {
        logger.warn(
          { err, avatarPublicId: user.avatarPublicId },
          'Failed to delete avatar from Cloudinary during account deletion',
        );
      });
    }
  }
}

export const usersService = new UsersService();
