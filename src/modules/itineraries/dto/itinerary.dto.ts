import { z } from 'zod';
import { BudgetLevel, TransportationMode, TravelStyle } from '@prisma/client';

export const CustomLocationInputSchema = z.object({
  name: z.string({ required_error: 'Location name is required' }).trim().min(1).max(150),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().trim().max(300).optional().nullable(),
});

export const ItineraryItemInputSchema = z.object({
  id: z.string().optional(),
  destinationId: z.string().optional().nullable(),
  customLocation: CustomLocationInputSchema.optional().nullable(),
  customTitle: z.string().trim().optional().nullable(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  timeSlot: z.string().trim().optional().nullable(),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  activityNotes: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).default(60),
  estimatedCost: z.coerce.number().min(0).default(0),
  distanceFromPrevKm: z.coerce.number().min(0).optional(),
  travelTimeFromPrevMinutes: z.coerce.number().int().min(0).optional(),
  isCompleted: z.boolean().optional().default(false),
});

export const ItineraryDayInputSchema = z.object({
  id: z.string().optional(),
  dayNumber: z.coerce.number().int().min(1).optional(),
  title: z.string().trim().min(1, 'Day title is required'),
  date: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(ItineraryItemInputSchema).optional(),
  activities: z.array(ItineraryItemInputSchema).optional(),
});

export const CreateItineraryDtoSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(2, 'Itinerary title must be at least 2 characters').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  daysCount: z.coerce.number().int().min(1).max(30).optional(),
  totalDays: z.coerce.number().int().min(1).max(30).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  travelStyle: z.nativeEnum(TravelStyle).default(TravelStyle.BEACH_RELAXATION),
  budgetLevel: z.nativeEnum(BudgetLevel).default(BudgetLevel.MID_RANGE),
  transportationMode: z.nativeEnum(TransportationMode).default(TransportationMode.CAR),
  startLocation: CustomLocationInputSchema.optional().nullable(),
  endLocation: CustomLocationInputSchema.optional().nullable(),
  pace: z.enum(['RELAXED', 'BALANCED', 'INTENSE']).default('BALANCED'),
  isPublic: z.boolean().default(false),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  days: z.array(ItineraryDayInputSchema).optional(),
});

export const UpdateItineraryDtoSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  transportationMode: z.nativeEnum(TransportationMode).optional(),
  startLocation: CustomLocationInputSchema.optional().nullable(),
  endLocation: CustomLocationInputSchema.optional().nullable(),
  pace: z.enum(['RELAXED', 'BALANCED', 'INTENSE']).optional(),
  isPublic: z.boolean().optional(),
  isSaved: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  days: z.array(ItineraryDayInputSchema).optional(),
});

export const AddDayDtoSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const UpdateDayDtoSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const AddActivityDtoSchema = z.object({
  destinationId: z.string().optional().nullable(),
  customLocation: CustomLocationInputSchema.optional().nullable(),
  customTitle: z.string().trim().max(150).optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  estimatedCost: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  activityNotes: z.string().trim().max(2000).optional().nullable(),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  timeSlot: z.string().trim().optional().nullable(),
  orderIndex: z.coerce.number().int().min(0).optional(),
}).refine(
  (data) => !!data.destinationId || !!data.customLocation || !!data.customTitle,
  {
    message: 'Either destinationId, customLocation, or customTitle must be provided',
    path: ['destinationId'],
  },
);

export const UpdateActivityDtoSchema = z.object({
  destinationId: z.string().optional().nullable(),
  customLocation: CustomLocationInputSchema.optional().nullable(),
  customTitle: z.string().trim().max(150).optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  activityNotes: z.string().trim().max(2000).optional().nullable(),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  timeSlot: z.string().trim().optional().nullable(),
  isCompleted: z.boolean().optional(),
});

export const ReorderActivitiesDtoSchema = z.object({
  activities: z
    .array(
      z.object({
        id: z.string({ required_error: 'Activity id is required' }),
        orderIndex: z.coerce.number().int().min(0),
      }),
    )
    .min(1, 'At least 1 activity order is required')
    .refine(
      (items) => {
        const orderSet = new Set(items.map((i) => i.orderIndex));
        return orderSet.size === items.length;
      },
      { message: 'Duplicate orderIndex values are not allowed', path: ['activities'] },
    ),
});

export const OptimizeItineraryDtoSchema = z.object({
  dayId: z.string().optional(),
  scope: z.enum(['DAY', 'ITINERARY']).optional().default('DAY'),
});

export const ItineraryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  transportationMode: z.nativeEnum(TransportationMode).optional(),
  isPublic: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  search: z.string().trim().optional(),
});

export type CustomLocation = z.infer<typeof CustomLocationInputSchema>;
export type CreateItineraryDto = z.infer<typeof CreateItineraryDtoSchema>;
export type UpdateItineraryDto = z.infer<typeof UpdateItineraryDtoSchema>;
export type AddDayDto = z.infer<typeof AddDayDtoSchema>;
export type UpdateDayDto = z.infer<typeof UpdateDayDtoSchema>;
export type AddActivityDto = z.infer<typeof AddActivityDtoSchema>;
export type UpdateActivityDto = z.infer<typeof UpdateActivityDtoSchema>;
export type ReorderActivitiesDto = z.infer<typeof ReorderActivitiesDtoSchema>;
export type OptimizeItineraryDto = z.infer<typeof OptimizeItineraryDtoSchema>;
export type ItineraryQuery = z.infer<typeof ItineraryQuerySchema>;
export type ItineraryDayInput = z.infer<typeof ItineraryDayInputSchema>;
export type ItineraryItemInput = z.infer<typeof ItineraryItemInputSchema>;

export interface RouteSegmentDto {
  fromActivityId: string | null;
  toActivityId: string | null;
  distanceKm: number;
  travelTimeMinutes: number;
}

export interface ItineraryActivityDto {
  id: string;
  dayId: string;
  orderIndex: number;
  timeSlot: string | null;
  startTime: string | null;
  endTime: string | null;
  destinationId: string | null;
  destination: {
    id: string;
    name: string;
    slug: string;
    category?: { id: string; name: string; slug: string } | null;
    coverImageUrl?: string | null;
    rating: number;
    region?: string | null;
    latitude?: number;
    longitude?: number;
  } | null;
  destinationName?: string;
  destinationCategory?: string;
  imageUrl?: string;
  customLocation: CustomLocation | null;
  customTitle: string | null;
  activityNotes: string | null;
  notes: string | null;
  estimatedDurationMinutes: number;
  estimatedCost: number;
  distanceFromPrevKm: number;
  travelTimeFromPrevMinutes: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryDayDto {
  id: string;
  itineraryId: string;
  dayNumber: number;
  title: string;
  date: string | null;
  notes: string | null;
  totalDistanceKm: number;
  totalTravelTimeMinutes: number;
  estimatedBudget: number;
  segments: RouteSegmentDto[];
  activities: ItineraryActivityDto[];
  items: ItineraryActivityDto[]; // Alias for backward compatibility
}

export interface ItineraryDto {
  id: string;
  userId: string | null;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  daysCount: number;
  totalDays: number;
  estimatedBudget: number;
  totalEstimatedBudget: number;
  totalDistanceKm: number;
  totalTravelTimeMinutes: number;
  travelStyle: TravelStyle;
  budgetLevel: BudgetLevel;
  transportationMode: TransportationMode;
  startLocation: CustomLocation | null;
  endLocation: CustomLocation | null;
  pace: string;
  isCustom: boolean;
  isPublic: boolean;
  isSaved: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  days: ItineraryDayDto[];
  createdAt: string;
  updatedAt: string;
}
