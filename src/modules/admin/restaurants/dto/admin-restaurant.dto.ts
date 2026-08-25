import { z } from 'zod';
import { DestinationStatus, LombokRegion } from '@prisma/client';

export const AdminRestaurantFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  cuisineType: z.string().trim().optional(),
  cuisine: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  status: z.nativeEnum(DestinationStatus).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  priceRange: z.string().trim().optional(),
  isFeatured: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  isHalalCertified: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  includeDeleted: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .default(false),
  sortBy: z
    .enum(['name', 'rating', 'reviewCount', 'minPrice', 'maxPrice', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sort_by: z
    .enum(['name', 'rating', 'reviewCount', 'minPrice', 'maxPrice', 'createdAt', 'updatedAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  createdFrom: z.string().trim().optional(),
  createdTo: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

export const CreateRestaurantSchema = z.object({
  name: z.string().trim().min(3, 'Restaurant name must be at least 3 characters'),
  slug: z.string().trim().optional(),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  cuisineType: z.string().trim().min(2, 'Cuisine type is required'),
  specialtyDish: z.string().trim().min(2, 'Specialty dish is required'),
  priceRange: z.string().trim().min(1, 'Price range is required'),
  minPrice: z.coerce.number().min(0).default(0),
  maxPrice: z.coerce.number().min(0).default(0),
  address: z.string().trim().min(5, 'Address is required'),
  region: z.nativeEnum(LombokRegion),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  openingHours: z.string().trim().min(3, 'Opening hours is required'),
  coverImageUrl: z.string().trim().url('Cover image URL must be a valid URL'),
  images: z.array(z.string().trim()).default([]),
  isHalalCertified: z.boolean().default(true),
  status: z.nativeEnum(DestinationStatus).default(DestinationStatus.PUBLISHED),
  isFeatured: z.boolean().default(false),
});

export const UpdateRestaurantSchema = z.object({
  name: z.string().trim().min(3).optional(),
  slug: z.string().trim().optional(),
  description: z.string().trim().min(10).optional(),
  cuisineType: z.string().trim().min(2).optional(),
  specialtyDish: z.string().trim().min(2).optional(),
  priceRange: z.string().trim().min(1).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  address: z.string().trim().min(5).optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  openingHours: z.string().trim().min(3).optional(),
  coverImageUrl: z.string().trim().url().optional(),
  images: z.array(z.string().trim()).optional(),
  isHalalCertified: z.boolean().optional(),
  status: z.nativeEnum(DestinationStatus).optional(),
  isFeatured: z.boolean().optional(),
});

export const DeleteRestaurantQuerySchema = z.object({
  hard: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .default(false),
});

export const UpdateRestaurantStatusSchema = z.object({
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({ message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'" }),
  }),
});

export type AdminRestaurantFilterQuery = z.infer<typeof AdminRestaurantFilterQuerySchema>;
export type CreateRestaurantDto = z.infer<typeof CreateRestaurantSchema>;
export type UpdateRestaurantDto = z.infer<typeof UpdateRestaurantSchema>;
export type UpdateRestaurantStatusDto = z.infer<typeof UpdateRestaurantStatusSchema>;
export type DeleteRestaurantQueryDto = z.infer<typeof DeleteRestaurantQuerySchema>;

export interface AdminRestaurantDto {
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
  images: string[];
  isHalalCertified: boolean;
  status: DestinationStatus;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
