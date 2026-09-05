import { z } from 'zod';
import { BudgetLevel, TravelStyle } from '@prisma/client';
import { DestinationDto } from '../../destinations/dto/destination.dto';
import { ZodBudgetLevelSchema, ZodTravelStyleSchema } from '../../../common/utils/enum.util';

export const RecommendationQuerySchema = z.object({
  travel_style: ZodTravelStyleSchema,
  travelStyle: ZodTravelStyleSchema,
  style: ZodTravelStyleSchema,
  budget_level: ZodBudgetLevelSchema,
  budgetLevel: ZodBudgetLevelSchema,
  budget: ZodBudgetLevelSchema,
  category: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  category_id: z.string().trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().positive().max(500).optional().default(100),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(6),
  duration_days: z.coerce.number().int().positive().optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
  days: z.coerce.number().int().positive().optional(),
});

export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

export interface RecommendationContext {
  userId?: string;
  travelStyle?: TravelStyle;
  budgetLevel?: BudgetLevel;
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit: number;
}

export interface ScoredRecommendation {
  destination: DestinationDto;
  score: number;
  matchReasons: string[];
  distanceKm?: number;
}

export interface RecommendationItemDto {
  destination: DestinationDto;
  score: number;
  matchReasons: string[];
  distanceKm?: number;
}

export interface RecommendationResponseDto {
  recommendations: RecommendationItemDto[];
  meta: {
    total: number;
    engine: string;
    personalized: boolean;
    travelStyle?: TravelStyle;
    budgetLevel?: BudgetLevel;
  };
}
