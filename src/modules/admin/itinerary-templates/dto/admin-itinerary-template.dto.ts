import { z } from 'zod';
import { BudgetLevel, TransportationMode, TravelStyle } from '@prisma/client';

export const AdminTemplateActivityInputSchema = z.object({
  id: z.string().optional(),
  destinationId: z.string().optional().nullable(),
  customLocation: z
    .union([
      z.string(),
      z.object({
        name: z.string().min(1),
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional().nullable(),
      }),
    ])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return null;
      return typeof val === 'string' ? val : JSON.stringify(val);
    }),
  customTitle: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).default(0),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  activityNotes: z.string().optional().nullable(),
  estimatedDurationMinutes: z.number().int().min(0).default(60),
  estimatedCost: z.number().min(0).default(0),
  distanceFromPrevKm: z.number().min(0).default(0),
  travelTimeFromPrevMinutes: z.number().int().min(0).default(0),
});

export const AdminTemplateDayInputSchema = z.object({
  id: z.string().optional(),
  dayNumber: z.number().int().min(1),
  title: z.string().min(1, 'Day title is required'),
  notes: z.string().optional().nullable(),
  totalDistanceKm: z.number().min(0).default(0),
  totalDurationMinutes: z.number().int().min(0).default(0),
  estimatedBudget: z.number().min(0).default(0),
  activities: z.array(AdminTemplateActivityInputSchema).default([]),
});

export const CreateItineraryTemplateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional().nullable(),
  coverImageUrl: z.string().url('Invalid cover image URL').optional().nullable(),
  totalDays: z.number().int().min(1).max(30).default(1),
  travelStyle: z.nativeEnum(TravelStyle).default(TravelStyle.BEACH_RELAXATION),
  budgetLevel: z.nativeEnum(BudgetLevel).default(BudgetLevel.MID_RANGE),
  transportationMode: z.nativeEnum(TransportationMode).default(TransportationMode.CAR),
  transportPaceNote: z.string().optional().nullable(),
  totalEstimatedBudget: z.number().min(0).default(0),
  totalDistanceKm: z.number().min(0).default(0),
  totalDurationMinutes: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  days: z.array(AdminTemplateDayInputSchema).optional(),
});

export const UpdateItineraryTemplateSchema = CreateItineraryTemplateSchema.partial();

export const AdminTemplateFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  isPublished: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  isFeatured: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  sortBy: z.enum(['sortOrder', 'createdAt', 'updatedAt', 'title', 'totalDays']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateItineraryTemplateInput = z.infer<typeof CreateItineraryTemplateSchema>;
export type UpdateItineraryTemplateInput = z.infer<typeof UpdateItineraryTemplateSchema>;
export type AdminTemplateFilterQuery = z.infer<typeof AdminTemplateFilterQuerySchema>;
