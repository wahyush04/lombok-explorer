import { z } from 'zod';
import {
  DifficultyLevel,
  LombokRegion,
  DestinationStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  TravelStyle,
} from '@prisma/client';

// ==========================================
// 1. GENERIC PARAMS & PAGINATION SCHEMAS
// ==========================================

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'ID parameter cannot be empty'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID format'),
});

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1, 'Slug parameter cannot be empty'),
});

export const destinationImageParamsSchema = z.object({
  id: z.string().trim().min(1, 'Destination ID cannot be empty'),
  imageId: z.string().trim().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be greater than or equal to 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sort_by: z.string().trim().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  status: z.string().trim().optional(),
  createdFrom: z.string().trim().optional(),
  createdTo: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

// ==========================================
// 2. DESTINATION SCHEMAS
// ==========================================

export const createDestinationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name must not exceed 150 characters'),
  slug: z.string().trim().optional(),
  shortDescription: z
    .string()
    .trim()
    .min(5, 'Short description must be at least 5 characters')
    .max(300, 'Short description must not exceed 300 characters'),
  description: z.string().trim().min(10, 'Full description must be at least 10 characters'),
  categoryId: z.string().trim().min(1, 'Category ID is required'),
  region: z.nativeEnum(LombokRegion, {
    errorMap: () => ({
      message:
        "Region must be one of: 'LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS'",
    }),
  }),
  locationName: z.string().trim().min(2, 'Location name is required'),
  address: z.string().trim().optional(),
  latitude: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  entranceFee: z.coerce.number().min(0, 'Entrance fee cannot be negative').default(0),
  currency: z.string().trim().default('IDR'),
  openingHours: z.string().trim().default('24 Jam'),
  estimatedDurationMinutes: z.coerce
    .number()
    .int()
    .min(10, 'Estimated duration must be at least 10 minutes')
    .default(60),
  bestVisitingTime: z.string().trim().default('Pagi / Sore'),
  difficulty: z.nativeEnum(DifficultyLevel).optional().default(DifficultyLevel.EASY),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([]),
  facilities: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([]),
  tips: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([]),
  coverImageUrl: z.string().trim().optional().default(''),
  status: z.nativeEnum(DestinationStatus).optional().default(DestinationStatus.PUBLISHED),
  isFeatured: z.boolean().optional().default(false),
});

export const updateDestinationSchema = createDestinationSchema.partial();

export const updateDestinationStatusSchema = z.object({
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({
      message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'",
    }),
  }),
});

// ==========================================
// 3. CATEGORY SCHEMAS
// ==========================================

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  slug: z.string().trim().optional(),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  iconName: z.string().trim().min(1, 'Icon name is required'),
  coverImageUrl: z.string().trim().optional().default(''),
  status: z.nativeEnum(DestinationStatus).optional().default(DestinationStatus.PUBLISHED),
});

export const updateCategorySchema = createCategorySchema.partial();

export const updateCategoryStatusSchema = z.object({
  status: z.nativeEnum(DestinationStatus, {
    errorMap: () => ({
      message: "Status must be either 'DRAFT', 'PUBLISHED', or 'ARCHIVED'",
    }),
  }),
});

// ==========================================
// 4. USER SCHEMAS
// ==========================================

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().trim().nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  travelStyle: z.nativeEnum(TravelStyle).nullable().optional(),
  preferredRegion: z.nativeEnum(LombokRegion).nullable().optional(),
  isEmailVerified: z.boolean().optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({
      message: "Status must be either 'ACTIVE', 'SUSPENDED', or 'INACTIVE'",
    }),
  }),
});

// ==========================================
// 5. REVIEW MODERATION SCHEMAS
// ==========================================

export const reviewModerationSchema = z.object({
  status: z.nativeEnum(ReviewStatus, {
    errorMap: () => ({
      message: "Status must be either 'APPROVED', 'PENDING', or 'REJECTED'",
    }),
  }),
  moderationNotes: z
    .string()
    .trim()
    .max(500, 'Moderation notes cannot exceed 500 characters')
    .optional(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export const adminReviewFilterQuerySchema = paginationSchema.extend({
  destinationId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
});
