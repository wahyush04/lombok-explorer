import {
  adminUsersRepository,
  AdminUsersRepository,
  UserWithStats,
} from './admin-users.repository';
import {
  AdminUserDto,
  AdminUserFilterQuery,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';
import { ForbiddenError, NotFoundError } from '../../../common/errors/app-error';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';

export class AdminUsersService {
  constructor(
    private readonly repository: AdminUsersRepository = adminUsersRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public mapToDto = (user: UserWithStats): AdminUserDto => {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      avatarPublicId: user.avatarPublicId,
      phone: user.phone,
      role: user.role,
      status: user.status,
      travelStyle: user.travelStyle,
      preferredRegion: user.preferredRegion,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      ...(user._count && {
        stats: {
          favoritesCount: user._count.favorites,
          reviewsCount: user._count.reviews,
          itinerariesCount: user._count.itineraries,
          journalsCount: user._count.journals,
        },
      }),
    };
  };

  public async getUsers(query: AdminUserFilterQuery) {
    const { items, total } = await this.repository.findMany(query);
    const limit = query.limit || 10;
    const page = query.page || 1;

    return {
      data: items.map(this.mapToDto),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getUserById(id: string): Promise<AdminUserDto> {
    const user = await this.repository.findById(id, true);
    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`, 'USER_NOT_FOUND');
    }
    return this.mapToDto(user);
  }

  public async updateUser(
    id: string,
    dto: UpdateUserDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserDto> {
    const existing = await this.repository.findById(id, true);
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`, 'USER_NOT_FOUND');
    }

    // Protect self from losing admin role or suspending own account
    if (adminUserId && adminUserId === id) {
      if (dto.role && dto.role !== existing.role) {
        throw new ForbiddenError('You cannot change your own admin role', 'CANNOT_CHANGE_OWN_ROLE');
      }
      if (dto.status && dto.status !== 'ACTIVE') {
        throw new ForbiddenError(
          'You cannot suspend or deactivate your own account',
          'CANNOT_DEACTIVATE_SELF',
        );
      }
    }

    let avatarUrlToUpdate: string | null | undefined = undefined;
    let avatarPublicIdToUpdate: string | null | undefined = undefined;
    let newPublicId: string | null = null;

    if (dto.avatar && typeof dto.avatar === 'object') {
      avatarUrlToUpdate = dto.avatar.secureUrl;
      avatarPublicIdToUpdate = dto.avatar.publicId;
      newPublicId = dto.avatar.publicId;
      if (adminUserId && newPublicId) {
        this.cloudinary.validateAdminAssetOwnership(newPublicId, adminUserId, 'USER');
      }
    } else if (dto.avatarUrl !== undefined) {
      avatarUrlToUpdate = dto.avatarUrl;
    }

    try {
      const updated = await this.repository.update(existing.id, {
        ...(dto.name && { name: dto.name }),
        ...(dto.role && { role: dto.role }),
        ...(dto.status && {
          status: dto.status,
          ...(dto.status === 'SUSPENDED' ? { refreshToken: null } : {}),
        }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(avatarUrlToUpdate !== undefined && { avatarUrl: avatarUrlToUpdate }),
        ...(avatarPublicIdToUpdate !== undefined && { avatarPublicId: avatarPublicIdToUpdate }),
        ...(dto.travelStyle !== undefined && { travelStyle: dto.travelStyle }),
        ...(dto.preferredRegion !== undefined && { preferredRegion: dto.preferredRegion }),
        ...(dto.isEmailVerified !== undefined && { isEmailVerified: dto.isEmailVerified }),
      });

      // Post-commit cleanup of old avatar asset
      if (newPublicId && existing.avatarPublicId && existing.avatarPublicId !== newPublicId) {
        this.cloudinary.deleteAsset(existing.avatarPublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: existing.avatarPublicId },
            'Failed to delete replaced user avatar asset',
          );
        });
      }

      // Audit log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: updated.id,
        details: JSON.stringify({ changes: dto }),
        ipAddress,
        userAgent,
      });

      return this.mapToDto(updated);
    } catch (error) {
      if (newPublicId) {
        logger.warn(
          { newPublicId, error },
          'Rolling back Cloudinary asset due to User update failure',
        );
        await this.cloudinary.deleteAsset(newPublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserDto> {
    const existing = await this.repository.findById(id, true);
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`, 'USER_NOT_FOUND');
    }

    if (adminUserId && adminUserId === id && dto.status !== 'ACTIVE') {
      throw new ForbiddenError(
        'You cannot change your own account status to inactive or suspended',
        'CANNOT_DEACTIVATE_SELF',
      );
    }

    const updated = await this.repository.update(existing.id, {
      status: dto.status,
      ...(dto.status === 'SUSPENDED' ? { refreshToken: null } : {}),
    });

    // Audit log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'UPDATE_USER_STATUS',
      entity: 'User',
      entityId: updated.id,
      details: JSON.stringify({ previousStatus: existing.status, newStatus: dto.status }),
      ipAddress,
      userAgent,
    });

    return this.mapToDto(updated);
  }

  public async deleteUser(
    id: string,
    hard = false,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.repository.findById(id, true);
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`, 'USER_NOT_FOUND');
    }

    if (adminUserId && adminUserId === id) {
      throw new ForbiddenError('You cannot delete your own account', 'CANNOT_DELETE_SELF');
    }

    if (hard) {
      await this.repository.hardDelete(existing.id);
      if (existing.avatarPublicId) {
        this.cloudinary.deleteAsset(existing.avatarPublicId).catch(() => {});
      }
    } else {
      await this.repository.softDelete(existing.id);
    }

    // Audit log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: hard ? 'HARD_DELETE_USER' : 'SOFT_DELETE_USER',
      entity: 'User',
      entityId: existing.id,
      details: JSON.stringify({ email: existing.email, hard }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminUsersService = new AdminUsersService();
