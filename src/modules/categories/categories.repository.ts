import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class CategoriesRepository {
  public async findAll() {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            destinations: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  public async findByIdOrSlug(idOrSlug: string) {
    return prisma.category.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug.toLowerCase().trim() }],
      },
      include: {
        _count: {
          select: {
            destinations: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  public async findDestinationsByCategory(
    categoryId: string,
    page = 1,
    limit = 10,
    sortBy = 'popular',
    order: 'asc' | 'desc' = 'desc',
  ) {
    const where: Prisma.DestinationWhereInput = {
      categoryId,
      deletedAt: null,
    };

    let orderBy: Prisma.DestinationOrderByWithRelationInput[];
    switch (sortBy) {
      case 'rating':
        orderBy = [{ rating: order }, { reviewCount: 'desc' }];
        break;
      case 'name':
        orderBy = [{ name: order }];
        break;
      case 'price_asc':
        orderBy = [{ entranceFee: 'asc' }, { rating: 'desc' }];
        break;
      case 'price_desc':
        orderBy = [{ entranceFee: 'desc' }, { rating: 'desc' }];
        break;
      case 'newest':
        orderBy = [{ createdAt: order }];
        break;
      case 'popular':
      default:
        orderBy = [{ rating: 'desc' }, { reviewCount: 'desc' }];
        break;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
}

export const categoriesRepository = new CategoriesRepository();
