import { z } from 'zod';
import { DifficultyLevel, LombokRegion } from '@prisma/client';

export const DestinationFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  max_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  tag: z.string().trim().optional(),
  is_featured: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  sort_by: z
    .enum(['popular', 'rating', 'name', 'price_asc', 'price_desc', 'newest', 'relevance'])
    .default('popular'),
  sortBy: z
    .enum(['popular', 'rating', 'name', 'price_asc', 'price_desc', 'newest', 'relevance'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const NearbyDestinationQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().default(25),
    radius_km: z.coerce.number().positive().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    category: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      (data.lat !== undefined || data.latitude !== undefined) &&
      (data.lng !== undefined || data.longitude !== undefined),
    {
      message: 'Latitude and longitude coordinates are required (lat/latitude, lng/longitude)',
    },
  );

export const SearchDestinationQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    query: z.string().trim().optional(),
    keyword: z.string().trim().optional(),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    region: z.nativeEnum(LombokRegion).optional(),
    difficulty: z.nativeEnum(DifficultyLevel).optional(),
    min_rating: z.coerce.number().min(0).max(5).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    max_price: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    min_price: z.coerce.number().min(0).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    tag: z.string().trim().optional(),
    is_featured: z
      .string()
      .transform((val) => val === 'true' || val === '1')
      .optional(),
    sort_by: z
      .enum(['relevance', 'popular', 'rating', 'name', 'price_asc', 'price_desc', 'newest'])
      .default('relevance'),
    sortBy: z
      .enum(['relevance', 'popular', 'rating', 'name', 'price_asc', 'price_desc', 'newest'])
      .optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine((data) => Boolean(data.q || data.query || data.keyword || data.search), {
    message: 'Search query parameter (q, query, keyword, or search) is required',
  });

export const DestinationParamSchema = z.object({
  id: z.string().min(1, 'Destination ID or slug is required'),
});

export type DestinationFilterQuery = z.infer<typeof DestinationFilterQuerySchema>;
export type NearbyDestinationQuery = z.infer<typeof NearbyDestinationQuerySchema>;
export type SearchDestinationQuery = z.infer<typeof SearchDestinationQuerySchema>;

export interface DestinationDto {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  region: LombokRegion;
  locationName: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  entranceFee: number;
  currency: string;
  openingHours: string;
  estimatedDurationMinutes: number;
  bestVisitingTime: string;
  difficulty: DifficultyLevel;
  tags: string[];
  coverImageUrl: string;
  images: string[];
  facilities: string[];
  tips: string[];
  isFeatured: boolean;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NearbyDestinationDto extends DestinationDto {
  distanceKm: number;
}
