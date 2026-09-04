import { Accommodation, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AccommodationFilterQuery } from './dto/accommodation.dto';

export class AccommodationsRepository {
  public async findMany(query: AccommodationFilterQuery): Promise<{
    items: Accommodation[];
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
    const typeFilter = query.type || query.category;
    const facilityFilter = query.amenity || query.facility;
    const searchKeyword = query.q || query.search;

    const where: Prisma.AccommodationWhereInput = {
      deletedAt: null,
      status: 'PUBLISHED',
      ...(isFeatured !== undefined && { isFeatured }),
      ...(query.region && { region: query.region }),
      ...(typeFilter && {
        type: { contains: typeFilter, mode: 'insensitive' },
      }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(minPrice !== undefined && { pricePerNight: { gte: minPrice } }),
      ...(maxPrice !== undefined && { pricePerNight: { lte: maxPrice } }),
      ...(facilityFilter && {
        amenities: { contains: facilityFilter, mode: 'insensitive' },
      }),
      ...(searchKeyword && {
        OR: [
          { name: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { description: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { type: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { address: { contains: searchKeyword.trim(), mode: 'insensitive' } },
          { amenities: { contains: searchKeyword.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.accommodation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
      }),
      prisma.accommodation.count({ where }),
    ]);

    return { items, total };
  }

  public async findFeatured(limit = 6): Promise<Accommodation[]> {
    return prisma.accommodation.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        isFeatured: true,
      },
      take: limit,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
    });
  }

  public async findByIdOrSlug(idOrSlug: string): Promise<Accommodation | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    if (isUuid) {
      const byId = await prisma.accommodation.findFirst({
        where: { id: idOrSlug, deletedAt: null, status: 'PUBLISHED' },
      });
      if (byId) return byId;
    }

    return prisma.accommodation.findFirst({
      where: { slug: idOrSlug, deletedAt: null, status: 'PUBLISHED' },
    });
  }
}

export const accommodationsRepository = new AccommodationsRepository();
