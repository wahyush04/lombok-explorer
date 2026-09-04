import { DestinationStatus } from '@prisma/client';
import {
  adminCategoriesRepository,
  AdminCategoriesRepository,
  CategoryWithDestinationsCount,
} from './admin-categories.repository';
import {
  AdminCategoryDto,
  AdminCategoryFilterQuery,
  CreateCategoryDto,
  DeleteCategoryQuery,
  UpdateCategoryDto,
} from './dto/admin-category.dto';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error';
import { categoriesService } from '../../categories/categories.service';
import { destinationsService } from '../../destinations/destinations.service';
import { PaginationMeta } from '../../../common/types';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';

export class AdminCategoriesService {
  constructor(
    private readonly repository: AdminCategoriesRepository = adminCategoriesRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public mapToAdminDto = (category: CategoryWithDestinationsCount): AdminCategoryDto => {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      iconName: category.iconName,
      coverImageUrl: category.coverImageUrl,
      coverImagePublicId: category.coverImagePublicId,
      status: category.status ?? DestinationStatus.PUBLISHED,
      destinationsCount: category._count?.destinations ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
    };
  };

  public async getCategories(query: AdminCategoryFilterQuery): Promise<{
    data: AdminCategoryDto[];
    meta: PaginationMeta;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map(this.mapToAdminDto),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public async getCategoryByIdOrSlug(
    idOrSlug: string,
    includeDeleted = false,
  ): Promise<AdminCategoryDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug, includeDeleted);
    if (!category) {
      throw new NotFoundError(`Category '${idOrSlug}' not found`, 'CATEGORY_NOT_FOUND');
    }
    return this.mapToAdminDto(category);
  }

  public async createCategory(
    dto: CreateCategoryDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminCategoryDto> {
    // 1. Check if name already exists
    const existingByName = await this.repository.findByName(dto.name.trim());
    if (existingByName) {
      throw new ConflictError(
        `Category with name '${dto.name}' already exists`,
        'CATEGORY_NAME_EXISTS',
      );
    }

    // 2. Generate and check slug
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    const existingBySlug = await this.repository.findBySlug(slug);
    if (existingBySlug) {
      throw new ConflictError(
        `Category with slug '${slug}' already exists`,
        'CATEGORY_SLUG_EXISTS',
      );
    }

    // 3. Resolve cover image & public ID
    let coverImageUrl = dto.coverImageUrl || '';
    let coverImagePublicId: string | null = null;

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrl = dto.coverImage.secureUrl;
      coverImagePublicId = dto.coverImage.publicId;
      if (adminUserId && coverImagePublicId) {
        this.cloudinary.validateAdminAssetOwnership(coverImagePublicId, adminUserId, 'CATEGORY');
      }
    }

    try {
      // 4. Create Category
      const created = await this.repository.create({
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        iconName: dto.iconName.trim(),
        coverImageUrl,
        coverImagePublicId,
        status: dto.status ?? DestinationStatus.PUBLISHED,
      });

      // Invalidate public categories cache
      categoriesService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_CATEGORY',
        entity: 'Category',
        entityId: created.id,
        details: JSON.stringify({ name: created.name, slug: created.slug }),
        ipAddress,
        userAgent,
      });

      return this.mapToAdminDto(created);
    } catch (error) {
      if (coverImagePublicId) {
        logger.warn(
          { coverImagePublicId, error },
          'Rolling back Cloudinary asset due to Category create failure',
        );
        await this.cloudinary.deleteAsset(coverImagePublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async updateCategory(
    idOrSlug: string,
    dto: UpdateCategoryDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminCategoryDto> {
    // 1. Verify Category exists
    const category = await this.repository.findByIdOrSlug(idOrSlug);
    if (!category) {
      throw new NotFoundError(`Category '${idOrSlug}' not found`, 'CATEGORY_NOT_FOUND');
    }

    // 2. Check Name uniqueness if changed
    if (dto.name && dto.name.trim() !== category.name) {
      const existingName = await this.repository.findByName(dto.name.trim());
      if (existingName && existingName.id !== category.id) {
        throw new ConflictError(
          `Category with name '${dto.name}' already exists`,
          'CATEGORY_NAME_EXISTS',
        );
      }
    }

    // 3. Check Slug uniqueness if changed
    let slugToUpdate: string | undefined;
    if (dto.slug && dto.slug !== category.slug) {
      const formattedSlug = this.slugify(dto.slug);
      const existingSlug = await this.repository.findBySlug(formattedSlug);
      if (existingSlug && existingSlug.id !== category.id) {
        throw new ConflictError(
          `Category with slug '${formattedSlug}' already exists`,
          'CATEGORY_SLUG_EXISTS',
        );
      }
      slugToUpdate = formattedSlug;
    }

    // 4. Resolve cover image
    let coverImageUrlToUpdate: string | undefined = undefined;
    let coverImagePublicIdToUpdate: string | null | undefined = undefined;
    let newPublicId: string | null = null;
    let isCoverUnchanged = false;

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrlToUpdate = dto.coverImage.secureUrl;
      coverImagePublicIdToUpdate = dto.coverImage.publicId;
      newPublicId = dto.coverImage.publicId;
      isCoverUnchanged = Boolean(
        (category.coverImagePublicId && category.coverImagePublicId === newPublicId) ||
        (category.coverImageUrl && category.coverImageUrl === coverImageUrlToUpdate),
      );

      if (adminUserId && newPublicId && !isCoverUnchanged) {
        this.cloudinary.validateAdminAssetOwnership(newPublicId, adminUserId, 'CATEGORY');
      }
    } else if (dto.coverImageUrl !== undefined) {
      coverImageUrlToUpdate = dto.coverImageUrl;
    }

    try {
      // 5. Update Category
      const updated = await this.repository.update(category.id, {
        ...(dto.name && { name: dto.name }),
        ...(slugToUpdate && { slug: slugToUpdate }),
        ...(dto.description && { description: dto.description }),
        ...(dto.iconName && { iconName: dto.iconName }),
        ...(coverImageUrlToUpdate !== undefined && { coverImageUrl: coverImageUrlToUpdate }),
        ...(coverImagePublicIdToUpdate !== undefined && {
          coverImagePublicId: coverImagePublicIdToUpdate,
        }),
        ...(dto.status && { status: dto.status }),
      });

      // Clean up old cover asset if replaced post-commit
      if (
        newPublicId &&
        !isCoverUnchanged &&
        category.coverImagePublicId &&
        category.coverImagePublicId !== newPublicId
      ) {
        this.cloudinary.deleteAsset(category.coverImagePublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: category.coverImagePublicId },
            'Failed to delete replaced category cover asset',
          );
        });
      }

      // Invalidate public categories and destinations caches
      categoriesService.clearCache();
      destinationsService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_CATEGORY',
        entity: 'Category',
        entityId: updated.id,
        details: JSON.stringify({ name: updated.name, changes: Object.keys(dto) }),
        ipAddress,
        userAgent,
      });

      return this.mapToAdminDto(updated);
    } catch (error) {
      if (newPublicId && !isCoverUnchanged) {
        logger.warn(
          { newPublicId, error },
          'Rolling back Cloudinary asset due to Category update failure',
        );
        await this.cloudinary.deleteAsset(newPublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async updateCategoryStatus(
    idOrSlug: string,
    status: DestinationStatus,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminCategoryDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!category) {
      throw new NotFoundError(`Category '${idOrSlug}' not found`, 'CATEGORY_NOT_FOUND');
    }

    const updated = await this.repository.update(category.id, {
      status,
      deletedAt: status === 'ARCHIVED' ? new Date() : null,
    });

    // Invalidate public categories and destinations caches
    categoriesService.clearCache();
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'UPDATE_CATEGORY_STATUS',
      entity: 'Category',
      entityId: updated.id,
      details: JSON.stringify({ previousStatus: category.status, newStatus: status }),
      ipAddress,
      userAgent,
    });

    return this.mapToAdminDto(updated);
  }

  public async deleteCategory(
    id: string,
    query: DeleteCategoryQuery,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // 1. Verify Category exists
    const category = await this.repository.findByIdOrSlug(id, true);
    if (!category) {
      throw new NotFoundError(`Category '${id}' not found`, 'CATEGORY_NOT_FOUND');
    }

    // 2. Check if destinations are using this category
    const destinationCount = await this.repository.countDestinations(category.id);
    if (destinationCount > 0) {
      if (query.reassignTo) {
        // Verify target category exists and is different
        if (query.reassignTo === category.id) {
          throw new ConflictError(
            'Cannot reassign destinations to the same category being deleted',
            'INVALID_REASSIGNMENT_TARGET',
          );
        }
        const targetCategory = await this.repository.findByIdOrSlug(query.reassignTo);
        if (!targetCategory) {
          throw new NotFoundError(
            `Target reassignment category '${query.reassignTo}' not found`,
            'TARGET_CATEGORY_NOT_FOUND',
          );
        }

        // Reassign destinations to new category
        await this.repository.reassignDestinations(category.id, targetCategory.id);
      } else {
        throw new ConflictError(
          `Cannot delete category '${category.name}' because it is currently assigned to ${destinationCount} destination(s). Please reassign them using '?reassignTo=<categoryId>' before deletion.`,
          'CATEGORY_IN_USE',
        );
      }
    }

    // 3. Delete Category (hard or soft)
    if (query.force) {
      await this.repository.hardDelete(category.id);
      if (category.coverImagePublicId) {
        this.cloudinary.deleteAsset(category.coverImagePublicId).catch(() => {});
      }
    } else {
      await this.repository.softDelete(category.id);
    }

    // Invalidate caches
    categoriesService.clearCache();
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: query.force ? 'HARD_DELETE_CATEGORY' : 'SOFT_DELETE_CATEGORY',
      entity: 'Category',
      entityId: category.id,
      details: JSON.stringify({
        name: category.name,
        slug: category.slug,
        reassignedTo: query.reassignTo ?? null,
        force: query.force ?? false,
      }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminCategoriesService = new AdminCategoriesService();
