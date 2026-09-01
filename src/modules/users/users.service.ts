import { Prisma, User } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { isReservedUsername } from '../../common/validators/username.validator';
import { SanitizedUser } from '../auth/dto/auth.dto';
import { UpdateProfileDto } from './dto/user.dto';
import { usersRepository, UsersRepository } from './users.repository';

export class UsersService {
  constructor(private readonly repository: UsersRepository = usersRepository) {}

  public sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      travelStyle: user.travelStyle,
      preferredRegion: user.preferredRegion,
      isEmailVerified: user.isEmailVerified,
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

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }
    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl ? dto.avatarUrl.trim() : null;
    }
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone ? dto.phone.trim() : null;
    }
    if (dto.travelStyle !== undefined) {
      updateData.travelStyle = dto.travelStyle;
    }
    if (dto.preferredRegion !== undefined) {
      updateData.preferredRegion = dto.preferredRegion;
    }

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
}

export const usersService = new UsersService();

