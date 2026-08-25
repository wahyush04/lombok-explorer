import { z } from 'zod';
import { DifficultyLevel, LombokRegion, DestinationStatus } from '@prisma/client';

export const AdminDestinationFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  category: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  status: z.nativeEnum(DestinationStatus).optional(),
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
  minRating: z.coerce.number().min(0).max(5).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  min_price: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  sortBy: z
    .enum(['name', 'rating', 'reviewCount', 'entranceFee', 'ticketPrice', 'createdAt', 'updatedAt'])
    .optional()
    .default('createdAt'),
  sort_by: z
    .enum(['name', 'rating', 'reviewCount', 'entranceFee', 'ticketPrice', 'createdAt', 'updatedAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  includeDeleted: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
});

export const CreateDestinationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name must not exceed 150 characters'),
  slug: z.string().trim().optional(),
  shortDescription: z
    .string()
    .max(300, 'Short description must not exceed 300 characters')
    .optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  categoryId: z.string().min(1, 'Category ID is required'),
  region: z.nativeEnum(LombokRegion, {
    errorMap: () => ({ message: 'Invalid Lombok region enum value' }),
  }),
  locationName: z.string().min(2, 'Location name is required'),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  ticketPrice: z.coerce.number().min(0, 'Ticket price cannot be negative').optional(),
  entranceFee: z.coerce.number().min(0, 'Entrance fee cannot be negative').optional(),
  currency: z.string().optional().default('IDR'),
  openingHours: z.string().optional().default('08:00 - 17:00'),
  estimatedDuration: z.coerce.number().int().positive().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional().default(60),
  bestVisitingTime: z.string().optional().default('Pagi / Sore hari'),
  difficulty: z.nativeEnum(DifficultyLevel).optional().default(DifficultyLevel.EASY),
  tags: z.array(z.string()).optional().default([]),
  coverImageUrl: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  facilities: z.array(z.string()).optional().default([]),
  tips: z.array(z.string()).optional().default([]),
  status: z.nativeEnum(DestinationStatus).optional().default(DestinationStatus.PUBLISHED),
  isFeatured: z.boolean().optional().default(false),
});

export const UpdateDestinationSchema = CreateDestinationSchema.partial();

export const UpdateDestinationStatusSchema = z.object({
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({ message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'" }),
  }),
});

export const BulkDeleteDestinationsSchema = z.object({
  ids: z
    .array(z.string().min(1, 'ID cannot be empty'))
    .min(1, 'At least one ID must be provided')
    .max(100, 'Cannot operate on more than 100 destinations at once'),
  hard: z.boolean().optional().default(false),
});

export const BulkUpdateDestinationStatusSchema = z.object({
  ids: z
    .array(z.string().min(1, 'ID cannot be empty'))
    .min(1, 'At least one ID must be provided')
    .max(100, 'Cannot operate on more than 100 destinations at once'),
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({ message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'" }),
  }),
});

export type AdminDestinationFilterQuery = z.infer<typeof AdminDestinationFilterQuerySchema>;
export type CreateDestinationDto = z.infer<typeof CreateDestinationSchema>;
export type UpdateDestinationDto = z.infer<typeof UpdateDestinationSchema>;
export type UpdateDestinationStatusDto = z.infer<typeof UpdateDestinationStatusSchema>;
export type BulkDeleteDestinationsDto = z.infer<typeof BulkDeleteDestinationsSchema>;
export type BulkUpdateDestinationStatusDto = z.infer<typeof BulkUpdateDestinationStatusSchema>;
