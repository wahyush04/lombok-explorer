import { z } from 'zod';
import { LombokRegion } from '@prisma/client';

export const RestaurantFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  cuisineType: z.string().trim().optional(),
  cuisine_type: z.string().trim().optional(),
  cuisine: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  priceRange: z.string().trim().optional(),
  price_range: z.string().trim().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  isHalalCertified: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  is_halal: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
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
    .enum(['name', 'rating', 'reviewCount', 'minPrice', 'maxPrice', 'createdAt'])
    .default('rating'),
  sort_by: z
    .enum(['name', 'rating', 'reviewCount', 'minPrice', 'maxPrice', 'createdAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export type RestaurantFilterQuery = z.infer<typeof RestaurantFilterQuerySchema>;

export interface RestaurantDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  cuisineType: string;
  specialtyDish: string;
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  rating: number;
  reviewCount: number;
  address: string;
  region: LombokRegion;
  latitude: number;
  longitude: number;
  openingHours: string;
  coverImageUrl: string;
  coverImagePublicId: string | null;
  images: string[];
  isHalalCertified: boolean;
  status: string;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
