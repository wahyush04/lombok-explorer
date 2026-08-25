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

export class AdminCategoriesService {
  constructor(private readonly repository: AdminCategoriesRepository = adminCategoriesRepository) {}

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
      destinationsCount: category._count?.destinations ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
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

  public async getCategoryByIdOrSlug(idOrSlug: string): Promise<AdminCategoryDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug);
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
    // 1. Verify Name Uniqueness
    const existingName = await this.repository.findByName(dto.name);
    if (existingName) {
      throw new ConflictError(
        `Category with name '${dto.name}' already exists`,
        'CATEGORY_NAME_EXISTS',
      );
    }

    // 2. Generate and Verify Slug Uniqueness
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictError(
        `Category with slug '${slug}' already exists`,
        'CATEGORY_SLUG_EXISTS',
      );
    }

    // 3. Create Category
    const created = await this.repository.create({
      name: dto.name,
      slug,
      description: dto.description,
      iconName: dto.iconName,
      coverImageUrl: dto.coverImageUrl || '',
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
  }

  public async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminCategoryDto> {
    // 1. Verify Category exists
    const category = await this.repository.findByIdOrSlug(id);
    if (!category) {
      throw new NotFoundError(`Category '${id}' not found`, 'CATEGORY_NOT_FOUND');
    }

    // 2. Check Name Uniqueness if updated
    if (dto.name && dto.name !== category.name) {
      const existingName = await this.repository.findByName(dto.name);
      if (existingName && existingName.id !== category.id) {
        throw new ConflictError(
          `Category with name '${dto.name}' already exists`,
          'CATEGORY_NAME_EXISTS',
        );
      }
    }

    // 3. Check Slug Uniqueness if updated
    let slugToUpdate = category.slug;
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

    // 4. Update Category
    const updated = await this.repository.update(category.id, {
      ...(dto.name && { name: dto.name }),
      ...(slugToUpdate && { slug: slugToUpdate }),
      ...(dto.description && { description: dto.description }),
      ...(dto.iconName && { iconName: dto.iconName }),
      ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
    });

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
  }

  public async deleteCategory(
    id: string,
    query: DeleteCategoryQuery,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // 1. Verify Category exists
    const category = await this.repository.findByIdOrSlug(id);
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

    // 3. Delete Category
    await this.repository.delete(category.id);

    // Invalidate caches
    categoriesService.clearCache();
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'DELETE_CATEGORY',
      entity: 'Category',
      entityId: category.id,
      details: JSON.stringify({
        name: category.name,
        slug: category.slug,
        reassignedTo: query.reassignTo ?? null,
      }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminCategoriesService = new AdminCategoriesService();
