import { Prisma, Restaurant } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { RestaurantFilterQuery } from './dto/restaurant.dto';

export class RestaurantsRepository {
  public async findMany(query: RestaurantFilterQuery): Promise<{
    items: Restaurant[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'rating';
    const order = query.sortOrder || query.sort_order || query.order || 'desc';

    const minRating = query.minRating ?? query.min_rating;
    const minPrice = query.minPrice ?? query.min_price;
    const maxPrice = query.maxPrice ?? query.max_price;
    const isFeatured = query.isFeatured ?? query.is_featured;
    const isHalalCertified = query.isHalalCertified ?? query.is_halal;
    const cuisineFilter =
      query.cuisineType || query.cuisine_type || query.cuisine || query.category;
    const searchKeyword = query.q || query.search;

    const where: Prisma.RestaurantWhereInput = {
      deletedAt: null,
      status: 'PUBLISHED',
      ...(isFeatured !== undefined && { isFeatured }),
      ...(isHalalCertified !== undefined && { isHalalCertified }),
      ...(query.region && { region: query.region }),
      ...(query.priceRange && { priceRange: query.priceRange }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(minPrice !== undefined && { minPrice: { gte: minPrice } }),
      ...(maxPrice !== undefined && { maxPrice: { lte: maxPrice } }),
      ...(cuisineFilter && {
        cuisineType: { contains: cuisineFilter, mode: 'insensitive' },
      }),
      ...(searchKeyword && {
        OR: [
          { name: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { specialtyDish: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { cuisineType: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { description: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { address: { contains: searchKeyword.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
      }),
      prisma.restaurant.count({ where }),
    ]);

    return { items, total };
  }

  public async findFeatured(limit = 6): Promise<Restaurant[]> {
    return prisma.restaurant.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        isFeatured: true,
      },
      take: limit,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    });
  }

  public async findByIdOrSlug(idOrSlug: string): Promise<Restaurant | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    if (isUuid) {
      const byId = await prisma.restaurant.findFirst({
        where: { id: idOrSlug, deletedAt: null, status: 'PUBLISHED' },
      });
      if (byId) return byId;
    }

    return prisma.restaurant.findFirst({
      where: { slug: idOrSlug, deletedAt: null, status: 'PUBLISHED' },
    });
  }
}

export const restaurantsRepository = new RestaurantsRepository();
