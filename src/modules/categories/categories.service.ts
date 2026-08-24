import { Category, Destination } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error';
import { categoriesRepository, CategoriesRepository } from './categories.repository';
import { CategoryDestinationsQuery, CategoryDto } from './dto/category.dto';
import { DestinationDto } from '../destinations/dto/destination.dto';
import { destinationsService, DestinationsService } from '../destinations/destinations.service';
import { PaginationMeta } from '../../common/types';

type CategoryWithCount = Category & {
  _count?: {
    destinations: number;
  };
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CategoriesService {
  private categoriesCache: CacheEntry<CategoryDto[]> | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

  constructor(
    private readonly repository: CategoriesRepository = categoriesRepository,
    private readonly destService: DestinationsService = destinationsService,
  ) {}

  public clearCache(): void {
    this.categoriesCache = null;
  }

  public mapToDto(category: CategoryWithCount): CategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      iconName: category.iconName,
      coverImageUrl: category.coverImageUrl,
      destinationCount: category._count?.destinations ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  public async getCategories(): Promise<CategoryDto[]> {
    const now = Date.now();
    if (this.categoriesCache && this.categoriesCache.expiresAt > now) {
      return this.categoriesCache.data;
    }

    const categories = await this.repository.findAll();
    const mapped = categories.map((cat: CategoryWithCount) => this.mapToDto(cat));

    this.categoriesCache = {
      data: mapped,
      expiresAt: now + this.CACHE_TTL_MS,
    };

    return mapped;
  }

  public async getCategoryByIdOrSlug(idOrSlug: string): Promise<CategoryDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug);
    if (!category) {
      throw new NotFoundError(`Category '${idOrSlug}' not found`, 'CATEGORY_NOT_FOUND');
    }

    return this.mapToDto(category as CategoryWithCount);
  }

  public async getCategoryDestinations(
    idOrSlug: string,
    query: CategoryDestinationsQuery,
  ): Promise<{ data: DestinationDto[]; meta: PaginationMeta }> {
    const category = await this.getCategoryByIdOrSlug(idOrSlug);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const sortBy = query.sort_by || 'popular';
    const order = query.order || 'desc';

    const { items, total } = await this.repository.findDestinationsByCategory(
      category.id,
      page,
      limit,
      sortBy,
      order,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item: Destination) => this.destService.mapToDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

export const categoriesService = new CategoriesService();
