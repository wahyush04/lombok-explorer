import { z } from 'zod';
import { DestinationStatus, LombokRegion } from '@prisma/client';

export const AdminAccommodationFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  status: z.nativeEnum(DestinationStatus).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  facility: z.string().trim().optional(),
  facilities: z.string().trim().optional(),
  amenity: z.string().trim().optional(),
  isFeatured: z
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
    .enum(['name', 'type', 'rating', 'reviewCount', 'pricePerNight', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sort_by: z
    .enum(['name', 'type', 'rating', 'reviewCount', 'pricePerNight', 'createdAt', 'updatedAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateAccommodationSchema = z.object({
  name: z.string().trim().min(3, 'Accommodation name must be at least 3 characters'),
  slug: z.string().trim().optional(),
  type: z
    .string()
    .trim()
    .min(2, 'Type is required (e.g. resort, villa, hotel, homestay, glamping)'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  pricePerNight: z.coerce.number().min(0, 'Price per night must be non-negative'),
  currency: z.string().trim().default('IDR'),
  address: z.string().trim().min(5, 'Address is required'),
  region: z.nativeEnum(LombokRegion),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  coverImageUrl: z.string().trim().url('Cover image URL must be a valid URL'),
  images: z.array(z.string().trim()).default([]),
  facilities: z.array(z.string().trim()).optional(),
  amenities: z.array(z.string().trim()).optional(),
  contactPhone: z.string().trim().optional(),
  websiteUrl: z.string().trim().url().optional(),
  status: z.nativeEnum(DestinationStatus).default(DestinationStatus.PUBLISHED),
  isFeatured: z.boolean().default(false),
});

export const UpdateAccommodationSchema = z.object({
  name: z.string().trim().min(3).optional(),
  slug: z.string().trim().optional(),
  type: z.string().trim().min(2).optional(),
  description: z.string().trim().min(10).optional(),
  pricePerNight: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional(),
  address: z.string().trim().min(5).optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  coverImageUrl: z.string().trim().url().optional(),
  images: z.array(z.string().trim()).optional(),
  facilities: z.array(z.string().trim()).optional(),
  amenities: z.array(z.string().trim()).optional(),
  contactPhone: z.string().trim().optional(),
  websiteUrl: z.string().trim().url().optional(),
  status: z.nativeEnum(DestinationStatus).optional(),
  isFeatured: z.boolean().optional(),
});

export const DeleteAccommodationQuerySchema = z.object({
  hard: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .default(false),
});

export const UpdateAccommodationStatusSchema = z.object({
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({ message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'" }),
  }),
});

export type AdminAccommodationFilterQuery = z.infer<typeof AdminAccommodationFilterQuerySchema>;
export type CreateAccommodationDto = z.infer<typeof CreateAccommodationSchema>;
export type UpdateAccommodationDto = z.infer<typeof UpdateAccommodationSchema>;
export type UpdateAccommodationStatusDto = z.infer<typeof UpdateAccommodationStatusSchema>;
export type DeleteAccommodationQueryDto = z.infer<typeof DeleteAccommodationQuerySchema>;

export interface AdminAccommodationDto {
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
  images: string[];
  facilities: string[];
  amenities: string[];
  contactPhone: string | null;
  websiteUrl: string | null;
  status: DestinationStatus;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
