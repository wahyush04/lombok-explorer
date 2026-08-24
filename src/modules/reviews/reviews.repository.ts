import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class ReviewsRepository {
  public async findManyByDestination(
    destinationId: string,
    page = 1,
    limit = 10,
    sortBy: 'newest' | 'highest' | 'lowest' | 'oldest' = 'newest',
  ) {
    const where: Prisma.ReviewWhereInput = {
      destinationId,
      deletedAt: null,
    };

    let orderBy: Prisma.ReviewOrderByWithRelationInput[];
    switch (sortBy) {
      case 'highest':
        orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'lowest':
        orderBy = [{ rating: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }];
        break;
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string) {
    return prisma.review.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  public async create(data: {
    userId: string;
    destinationId: string;
    rating: number;
    content: string;
    photos?: string | null;
  }) {
    return prisma.review.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  public async update(
    id: string,
    data: {
      rating?: number;
      content?: string;
      photos?: string | null;
    },
  ) {
    return prisma.review.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  public async delete(id: string) {
    return prisma.review.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Efficiently recalculates destination average rating and total review count
   * using DB-level indexed aggregation.
   */
  public async recalculateDestinationRating(
    destinationId: string,
  ): Promise<{ rating: number; reviewCount: number }> {
    const aggregate = await prisma.review.aggregate({
      where: {
        destinationId,
        deletedAt: null,
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    const avgRating = aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : 0.0;
    const reviewCount = aggregate._count.id || 0;

    await prisma.destination.update({
      where: { id: destinationId },
      data: {
        rating: avgRating,
        reviewCount,
      },
    });

    return { rating: avgRating, reviewCount };
  }
}

export const reviewsRepository = new ReviewsRepository();
