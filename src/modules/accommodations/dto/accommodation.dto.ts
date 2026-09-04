import { z } from 'zod';
import { LombokRegion } from '@prisma/client';

export const AccommodationFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  amenity: z.string().trim().optional(),
  facility: z.string().trim().optional(),
  isFeatured: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  is_featured: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  sortBy: z
    .enum(['name', 'type', 'rating', 'reviewCount', 'pricePerNight', 'createdAt'])
    .default('rating'),
  sort_by: z
    .enum(['name', 'type', 'rating', 'reviewCount', 'pricePerNight', 'createdAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export type AccommodationFilterQuery = z.infer<typeof AccommodationFilterQuerySchema>;

export interface AccommodationDto {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  rating: number;
  reviewCount: number;
  pricePerNight: number;
  currency: string;
  address: string;
  region: LombokRegion;
  latitude: number;
  longitude: number;
  coverImageUrl: string;
  coverImagePublicId: string | null;
  images: string[];
  amenities: string[];
  contactPhone: string | null;
  websiteUrl: string | null;
  status: string;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
