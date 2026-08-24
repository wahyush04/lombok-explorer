import { z } from 'zod';

export const DashboardQuerySchema = z.object({
  startDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    ),
  endDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    ),
  start_date: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    ),
  end_date: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    ),
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export interface DashboardPopularDestinationDto {
  id: string;
  name: string;
  slug: string;
  region: string;
  categoryName: string;
  rating: number;
  reviewCount: number;
  coverImageUrl: string;
}

export interface DashboardFavoritedDestinationDto {
  id: string;
  name: string;
  slug: string;
  region: string;
  categoryName: string;
  rating: number;
  favoritesCount: number;
  coverImageUrl: string;
}

export interface DashboardStatisticsDto {
  overview: {
    totalUsers: number;
    totalDestinations: number;
    totalCategories: number;
    totalRestaurants: number;
    totalAccommodations: number;
    totalReviews: number;
    pendingReviews: number;
    totalItineraries: number;
  };
  periodicMetrics: {
    newUsers: number;
    newReviews: number;
    newItineraries: number;
    dateRange: {
      startDate: string | null;
      endDate: string | null;
    };
  };
  highlights: {
    popularDestinations: DashboardPopularDestinationDto[];
    mostFavoritedDestinations: DashboardFavoritedDestinationDto[];
  };
}
