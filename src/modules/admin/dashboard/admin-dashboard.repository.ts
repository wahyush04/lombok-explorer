import { prisma } from '../../../database/prisma';
import { ReviewStatus } from '@prisma/client';

export interface DateFilterRange {
  start?: Date;
  end?: Date;
}

export class AdminDashboardRepository {
  public async getOverviewCounts() {
    const [
      totalUsers,
      totalDestinations,
      totalCategories,
      totalRestaurants,
      totalAccommodations,
      totalReviews,
      pendingReviews,
      totalItineraries,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.destination.count({ where: { deletedAt: null } }),
      prisma.category.count(),
      prisma.restaurant.count({ where: { deletedAt: null } }),
      prisma.accommodation.count({ where: { deletedAt: null } }),
      prisma.review.count({ where: { deletedAt: null } }),
      prisma.review.count({ where: { status: ReviewStatus.PENDING, deletedAt: null } }),
      prisma.itinerary.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalUsers,
      totalDestinations,
      totalCategories,
      totalRestaurants,
      totalAccommodations,
      totalReviews,
      pendingReviews,
      totalItineraries,
    };
  }

  public async getPeriodicCounts(range: DateFilterRange) {
    const whereDateClause =
      range.start || range.end
        ? {
            createdAt: {
              ...(range.start && { gte: range.start }),
              ...(range.end && { lte: range.end }),
            },
          }
        : {};

    const [newUsers, newReviews, newItineraries] = await Promise.all([
      prisma.user.count({
        where: {
          ...whereDateClause,
          deletedAt: null,
        },
      }),
      prisma.review.count({
        where: {
          ...whereDateClause,
          deletedAt: null,
        },
      }),
      prisma.itinerary.count({
        where: {
          ...whereDateClause,
          deletedAt: null,
        },
      }),
    ]);

    return {
      newUsers,
      newReviews,
      newItineraries,
    };
  }

  public async getPopularDestinations(limit = 5) {
    return prisma.destination.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: [{ reviewCount: 'desc' }, { rating: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        rating: true,
        reviewCount: true,
        coverImageUrl: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  public async getMostFavoritedDestinations(limit = 5) {
    return prisma.destination.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: {
        favorites: {
          _count: 'desc',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        rating: true,
        coverImageUrl: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            favorites: true,
          },
        },
      },
    });
  }
}

export const adminDashboardRepository = new AdminDashboardRepository();
