import { z } from 'zod';
import { BudgetLevel, TravelStyle } from '@prisma/client';

export const ItineraryItemInputSchema = z.object({
  id: z.string().optional(),
  destinationId: z.string().optional().nullable(),
  customTitle: z.string().trim().optional().nullable(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  timeSlot: z.string().trim().optional().nullable(),
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  activityNotes: z.string().trim().optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).default(60),
  estimatedCost: z.coerce.number().min(0).default(0),
});

export const ItineraryDayInputSchema = z.object({
  id: z.string().optional(),
  dayNumber: z.coerce.number().int().min(1).optional(),
  title: z.string().trim().min(1, 'Day title is required'),
  date: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(ItineraryItemInputSchema).default([]),
  activities: z.array(ItineraryItemInputSchema).optional(),
});

export const CreateItineraryDtoSchema = z.object({
  title: z.string().trim().min(3, 'Itinerary title must be at least 3 characters').max(200),
  description: z.string().trim().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  totalEstimatedBudget: z.coerce.number().min(0).optional(),
  travelStyle: z.nativeEnum(TravelStyle).default(TravelStyle.BEACH_RELAXATION),
  budgetLevel: z.nativeEnum(BudgetLevel).default(BudgetLevel.MID_RANGE),
  pace: z.enum(['RELAXED', 'BALANCED', 'INTENSE']).default('BALANCED'),
  isPublic: z.boolean().default(false),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  days: z.array(ItineraryDayInputSchema).min(1, 'Itinerary must contain at least 1 day'),
});

export const UpdateItineraryDtoSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  totalEstimatedBudget: z.coerce.number().min(0).optional(),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  pace: z.enum(['RELAXED', 'BALANCED', 'INTENSE']).optional(),
  isPublic: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  days: z.array(ItineraryDayInputSchema).optional(),
});

export const ItineraryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  isPublic: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  search: z.string().trim().optional(),
});

export const ItineraryParamSchema = z.object({
  id: z.string().min(1, 'Itinerary ID is required'),
});

export type CreateItineraryDto = z.infer<typeof CreateItineraryDtoSchema>;
export type UpdateItineraryDto = z.infer<typeof UpdateItineraryDtoSchema>;
export type ItineraryQuery = z.infer<typeof ItineraryQuerySchema>;
export type ItineraryDayInput = z.infer<typeof ItineraryDayInputSchema>;
export type ItineraryItemInput = z.infer<typeof ItineraryItemInputSchema>;

export interface ItineraryActivityDto {
  id: string;
  orderIndex: number;
  timeSlot: string | null;
  startTime?: string;
  endTime?: string;
  destinationId: string | null;
  destinationName?: string;
  destinationCategory?: string;
  imageUrl?: string;
  customTitle?: string | null;
  activityNotes: string | null;
  estimatedDurationMinutes: number;
  estimatedCost: number;
}

export interface ItineraryDayDto {
  id: string;
  dayNumber: number;
  title: string;
  date: string | null;
  notes: string | null;
  activities: ItineraryActivityDto[];
}

export interface ItineraryDto {
  id: string;
  userId: string | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  totalDays: number;
  totalEstimatedBudget: number;
  travelStyle: TravelStyle;
  budgetLevel: BudgetLevel;
  pace: string;
  isPublic: boolean;
  isSaved: boolean;
  startDate: string | null;
  endDate: string | null;
  days?: ItineraryDayDto[];
  createdAt: Date;
  updatedAt: Date;
}
