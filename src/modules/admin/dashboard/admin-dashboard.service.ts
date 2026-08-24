import {
  adminDashboardRepository,
  AdminDashboardRepository,
  DateFilterRange,
} from './admin-dashboard.repository';
import {
  DashboardFavoritedDestinationDto,
  DashboardPopularDestinationDto,
  DashboardQuery,
  DashboardStatisticsDto,
} from './dto/admin-dashboard.dto';

export class AdminDashboardService {
  constructor(private readonly repository: AdminDashboardRepository = adminDashboardRepository) {}

  public parseDateRange(query: DashboardQuery): {
    range: DateFilterRange;
    startDateStr: string | null;
    endDateStr: string | null;
  } {
    const rawStart = query.startDate || query.start_date;
    const rawEnd = query.endDate || query.end_date;

    const range: DateFilterRange = {};
    let startDateStr: string | null = null;
    let endDateStr: string | null = null;

    if (rawStart) {
      const parsedStart = new Date(rawStart);
      if (!isNaN(parsedStart.getTime())) {
        range.start = parsedStart;
        startDateStr = parsedStart.toISOString();
      }
    }

    if (rawEnd) {
      const parsedEnd = new Date(rawEnd);
      if (!isNaN(parsedEnd.getTime())) {
        // If it's date only (YYYY-MM-DD), set to end of day
        if (rawEnd.length === 10) {
          parsedEnd.setUTCHours(23, 59, 59, 999);
        }
        range.end = parsedEnd;
        endDateStr = parsedEnd.toISOString();
      }
    }

    return { range, startDateStr, endDateStr };
  }

  public async getDashboardStatistics(query: DashboardQuery): Promise<DashboardStatisticsDto> {
    const { range, startDateStr, endDateStr } = this.parseDateRange(query);

    // Fetch metrics in parallel
    const [overview, periodic, popularList, favoritedList] = await Promise.all([
      this.repository.getOverviewCounts(),
      this.repository.getPeriodicCounts(range),
      this.repository.getPopularDestinations(5),
      this.repository.getMostFavoritedDestinations(5),
    ]);

    const popularDestinations: DashboardPopularDestinationDto[] = popularList.map((dest) => ({
      id: dest.id,
      name: dest.name,
      slug: dest.slug,
      region: dest.region,
      categoryName: dest.category.name,
      rating: dest.rating,
      reviewCount: dest.reviewCount,
      coverImageUrl: dest.coverImageUrl,
    }));

    const mostFavoritedDestinations: DashboardFavoritedDestinationDto[] = favoritedList.map(
      (dest) => ({
        id: dest.id,
        name: dest.name,
        slug: dest.slug,
        region: dest.region,
        categoryName: dest.category.name,
        rating: dest.rating,
        favoritesCount: dest._count.favorites,
        coverImageUrl: dest.coverImageUrl,
      }),
    );

    return {
      overview: {
        totalUsers: overview.totalUsers,
        totalDestinations: overview.totalDestinations,
        totalCategories: overview.totalCategories,
        totalRestaurants: overview.totalRestaurants,
        totalAccommodations: overview.totalAccommodations,
        totalReviews: overview.totalReviews,
        pendingReviews: overview.pendingReviews,
        totalItineraries: overview.totalItineraries,
      },
      periodicMetrics: {
        newUsers: periodic.newUsers,
        newReviews: periodic.newReviews,
        newItineraries: periodic.newItineraries,
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr,
        },
      },
      highlights: {
        popularDestinations,
        mostFavoritedDestinations,
      },
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
