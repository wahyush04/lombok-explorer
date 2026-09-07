import { Category, CategoryTranslation, Destination, DestinationTranslation } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error';
import { categoriesRepository, CategoriesRepository } from './categories.repository';
import { CategoryDestinationsQuery, CategoryDto } from './dto/category.dto';
import { DestinationDto } from '../destinations/dto/destination.dto';
import { destinationsService, DestinationsService } from '../destinations/destinations.service';
import { PaginationMeta } from '../../common/types';
import { resolveLocalizedFields } from '../../i18n/content-fallback.util';
import { DEFAULT_LOCALE } from '../../i18n/types';

type CategoryWithRelations = Category & {
  translations?: CategoryTranslation[];
  _count?: {
    destinations: number;
  };
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CategoriesService {
  private categoriesCache = new Map<string, CacheEntry<CategoryDto[]>>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

  constructor(
    private readonly repository: CategoriesRepository = categoriesRepository,
    private readonly destService: DestinationsService = destinationsService,
  ) {}

  public clearCache(): void {
    this.categoriesCache.clear();
  }

  public mapToDto(category: CategoryWithRelations, locale: string = DEFAULT_LOCALE): CategoryDto {
    const localized = resolveLocalizedFields(
      locale,
      category.translations,
      category,
      ['name', 'description'],
    );

    return {
      id: category.id,
      slug: category.slug,
      name: localized.name,
      description: localized.description,
      iconName: category.iconName,
      coverImageUrl: category.coverImageUrl,
      destinationCount: category._count?.destinations ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  public async getCategories(locale: string = DEFAULT_LOCALE): Promise<CategoryDto[]> {
    const now = Date.now();
    const cacheKey = `categories:${locale}`;
    const cached = this.categoriesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const categories = await this.repository.findAll();
    const mapped = categories.map((cat: CategoryWithRelations) => this.mapToDto(cat, locale));

    this.categoriesCache.set(cacheKey, {
      data: mapped,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return mapped;
  }

  public async getCategoryByIdOrSlug(
    idOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<CategoryDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug);
    if (!category) {
      throw new NotFoundError(`Category '${idOrSlug}' not found`, 'CATEGORY_NOT_FOUND');
    }

    return this.mapToDto(category as CategoryWithRelations, locale);
  }

  public async getCategoryDestinations(
    idOrSlug: string,
    query: CategoryDestinationsQuery,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{ data: DestinationDto[]; meta: PaginationMeta }> {
    const category = await this.getCategoryByIdOrSlug(idOrSlug, locale);
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
      data: items.map((item: Destination & { translations?: DestinationTranslation[] }) =>
        this.destService.mapToDto(item, undefined, locale),
      ),
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
