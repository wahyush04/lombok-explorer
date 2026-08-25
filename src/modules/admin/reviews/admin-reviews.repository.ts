import { Prisma, Review, ReviewStatus } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminReviewFilterQuery } from './dto/admin-review.dto';

export type ReviewWithUserAndDestination = Review & {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  destination: {
    id: string;
    name: string;
    slug: string;
    locationName: string;
  } | null;
};

export class AdminReviewsRepository {
  public async findMany(query: AdminReviewFilterQuery): Promise<{
    items: ReviewWithUserAndDestination[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const order = query.sortOrder || query.sort_order || query.order || 'desc';

    const minRating = query.minRating ?? query.rating;
    const maxRating = query.maxRating ?? query.rating;

    // Date range filtering
    const startDateStr = query.createdFrom || query.startDate || query.fromDate;
    const endDateStr = query.createdTo || query.endDate || query.toDate;
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (startDateStr) {
      createdAtFilter.gte = new Date(startDateStr);
    }
    if (endDateStr) {
      const parsedEndDate = new Date(endDateStr);
      if (endDateStr.length <= 10) {
        parsedEndDate.setUTCHours(23, 59, 59, 999);
      }
      createdAtFilter.lte = parsedEndDate;
    }

    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.destinationId && { destinationId: query.destinationId }),
      ...(query.userId && { userId: query.userId }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(maxRating !== undefined && { rating: { lte: maxRating } }),
      ...(Object.keys(createdAtFilter).length > 0 && { createdAt: createdAtFilter }),
      ...(query.search && {
        OR: [
          { content: { contains: query.search.trim(), mode: 'insensitive' } },
          { user: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
          { user: { email: { contains: query.search.trim(), mode: 'insensitive' } } },
          { destination: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          destination: {
            select: {
              id: true,
              name: true,
              slug: true,
              locationName: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string): Promise<ReviewWithUserAndDestination | null> {
    return prisma.review.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        destination: {
          select: {
            id: true,
            name: true,
            slug: true,
            locationName: true,
          },
        },
      },
    });
  }

  public async updateStatus(id: string, status: ReviewStatus): Promise<Review> {
    return prisma.review.update({
      where: { id },
      data: { status },
    });
  }

  public async delete(id: string): Promise<Review> {
    return prisma.review.delete({
      where: { id },
    });
  }

  public async recalculateDestinationRating(destinationId: string): Promise<void> {
    const aggregate = await prisma.review.aggregate({
      where: {
        destinationId,
        status: ReviewStatus.APPROVED,
        deletedAt: null,
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    const averageRating = aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0.0;
    const reviewCount = aggregate._count.id || 0;

    await prisma.destination.update({
      where: { id: destinationId },
      data: {
        rating: averageRating,
        reviewCount,
      },
    });
  }
}

export const adminReviewsRepository = new AdminReviewsRepository();
