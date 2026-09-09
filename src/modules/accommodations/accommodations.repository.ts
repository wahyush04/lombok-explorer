import { Accommodation, AccommodationImage, AccommodationTranslation, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AccommodationFilterQuery } from './dto/accommodation.dto';

export type AccommodationWithTranslations = Accommodation & {
  translations?: AccommodationTranslation[];
  images?: AccommodationImage[];
  favorites?: { id: string }[];
};

export class AccommodationsRepository {
  public async findMany(
    query: AccommodationFilterQuery,
    userId?: string,
  ): Promise<{
    items: AccommodationWithTranslations[];
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
        include: {
          translations: true,
          images: {
            orderBy: { orderIndex: 'asc' },
          },
          ...(userId ? { favorites: { where: { userId }, select: { id: true } } } : {}),
        },
      }),
      prisma.accommodation.count({ where }),
    ]);

    return { items, total };
  }

  public async findFeatured(limit = 6, userId?: string): Promise<AccommodationWithTranslations[]> {
    return prisma.accommodation.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        isFeatured: true,
      },
      take: limit,
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      include: {
        translations: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        ...(userId ? { favorites: { where: { userId }, select: { id: true } } } : {}),
      },
    });
  }

  public async findByIdOrSlug(idOrSlug: string, userId?: string): Promise<AccommodationWithTranslations | null> {
    const include = {
      translations: true,
      images: {
        orderBy: { orderIndex: 'asc' as const },
      },
      ...(userId ? { favorites: { where: { userId }, select: { id: true } } } : {}),
    };

    return prisma.accommodation.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
        status: 'PUBLISHED',
      },
      include,
    });
  }
}

export const accommodationsRepository = new AccommodationsRepository();
