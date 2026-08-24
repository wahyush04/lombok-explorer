import { DifficultyLevel, LombokRegion, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

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
        { category: { name: { contains: filters.category } } },
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

    if (filters.search) {
      const searchTerm = filters.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
            { shortDescription: { contains: searchTerm } },
            { locationName: { contains: searchTerm } },
            { tags: { contains: searchTerm } },
          ],
        },
      ];
    }

    if (filters.tag) {
      where.tags = { contains: filters.tag };
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

  public async findMany(filters: DestinationQueryFilters) {
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
        },
      }),
      prisma.destination.count({ where }),
    ]);

    return { items, total };
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

  public async findFeatured(limit = 6) {
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
      },
    });
  }

  public async findAllForGeospatial(categoryFilter?: string, limit = 200) {
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
      },
    });
  }
}

export const destinationsRepository = new DestinationsRepository();
