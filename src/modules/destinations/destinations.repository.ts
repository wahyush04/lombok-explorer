import { DifficultyLevel, LombokRegion, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { destinationsSearchService, DestinationWithRelations } from './destinations.search';

export { DestinationWithRelations };

export interface DestinationQueryFilters {
  search?: string;
  category?: string;
  region?: LombokRegion;
  difficulty?: DifficultyLevel;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  tag?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export class DestinationsRepository {
  private buildWhereClause(
    filters: Partial<DestinationQueryFilters>,
  ): Prisma.DestinationWhereInput {
    const where: Prisma.DestinationWhereInput = {
      deletedAt: null,
    };

    if (filters.category) {
      where.OR = [
        { categoryId: filters.category },
        { category: { slug: filters.category.toLowerCase().trim() } },
        { category: { name: { contains: filters.category, mode: 'insensitive' } } },
      ];
    }

    if (filters.region) {
      where.region = filters.region;
    }

    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }

    if (filters.minRating !== undefined) {
      where.rating = { gte: filters.minRating };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.entranceFee = {
        ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
      };
    }

    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters.tag) {
      where.tags = { contains: filters.tag, mode: 'insensitive' };
    }

    return where;
  }

  private buildOrderBy(
    sortBy = 'popular',
    order: 'asc' | 'desc' = 'desc',
  ): Prisma.DestinationOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'rating':
        return [{ rating: order }, { reviewCount: 'desc' }];
      case 'name':
        return [{ name: order }];
      case 'price_asc':
        return [{ entranceFee: 'asc' }, { rating: 'desc' }];
      case 'price_desc':
        return [{ entranceFee: 'desc' }, { rating: 'desc' }];
      case 'newest':
        return [{ createdAt: order }];
      case 'popular':
      default:
        return [{ rating: 'desc' }, { reviewCount: 'desc' }, { isFeatured: 'desc' }];
    }
  }

  public async findMany(
    filters: DestinationQueryFilters,
    userId?: string,
  ): Promise<{ items: DestinationWithRelations[]; total: number }> {
    // If search term is present, utilize PostgreSQL Full-Text Search + pg_trgm similarity engine
    if (filters.search && filters.search.trim().length > 0) {
      return destinationsSearchService.search({
        search: filters.search.trim(),
        category: filters.category,
        region: filters.region,
        difficulty: filters.difficulty,
        minRating: filters.minRating,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        isFeatured: filters.isFeatured,
        tag: filters.tag,
        sortBy: filters.sortBy,
        order: filters.order,
        page: filters.page,
        limit: filters.limit,
        userId,
      });
    }

    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderBy(filters.sortBy, filters.order);
    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        orderBy,
        skip,
        take: filters.limit,
        include: {
          category: true,
          images: {
            orderBy: { orderIndex: 'asc' },
          },
          ...(userId && {
            favorites: {
              where: { userId },
            },
          }),
        },
      }),
      prisma.destination.count({ where }),
    ]);

    return { items: items as unknown as DestinationWithRelations[], total };
  }

  public async findByIdOrSlug(idOrSlug: string, userId?: string) {
    return prisma.destination.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        ...(userId && {
          favorites: {
            where: { userId },
          },
        }),
      },
    });
  }

  public async findFeatured(limit = 6, userId?: string) {
    return prisma.destination.findMany({
      where: {
        isFeatured: true,
        deletedAt: null,
      },
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      take: limit,
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        ...(userId && {
          favorites: {
            where: { userId },
          },
        }),
      },
    });
  }

  public async findAllForGeospatial(categoryFilter?: string, limit = 200, userId?: string) {
    return prisma.destination.findMany({
      where: {
        deletedAt: null,
        ...(categoryFilter && {
          OR: [
            { categoryId: categoryFilter },
            { category: { slug: categoryFilter.toLowerCase() } },
          ],
        }),
      },
      take: limit,
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        ...(userId && {
          favorites: {
            where: { userId },
          },
        }),
      },
    });
  }
}

export const destinationsRepository = new DestinationsRepository();
