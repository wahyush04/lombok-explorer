import { z } from 'zod';
import { BudgetLevel, TravelStyle } from '@prisma/client';
import { ItineraryDto } from './itinerary.dto';

export const TransportationTypeEnum = z.enum(['CAR', 'MOTORCYCLE', 'WALKING', 'PUBLIC_BOAT']);
export type TransportationType = z.infer<typeof TransportationTypeEnum>;

export const TravelPaceEnum = z.enum(['RELAXED', 'BALANCED', 'INTENSE']);
export type TravelPace = z.infer<typeof TravelPaceEnum>;

export const StartLocationSchema = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
]);

export const GenerateItineraryDtoSchema = z.object({
  startLocation: StartLocationSchema.default('Bandara Internasional Lombok (LOP)'),
  startDate: z.string().min(1, 'startDate is required (YYYY-MM-DD)'),
  endDate: z.string().min(1, 'endDate is required (YYYY-MM-DD)'),
  budget: z.coerce.number().min(0).optional(),
  numberOfTravelers: z.coerce.number().int().min(1).default(1),
  travelers: z.coerce.number().int().min(1).optional(),
  transportation: TransportationTypeEnum.default('CAR'),
  travelStyle: z.nativeEnum(TravelStyle).default(TravelStyle.BEACH_RELAXATION),
  interests: z.array(z.string().trim()).optional().default([]),
  startTime: z.string().trim().default('08:30'),
  endTime: z.string().trim().default('19:00'),
  travelPace: TravelPaceEnum.default('BALANCED'),
  budgetLevel: z.nativeEnum(BudgetLevel).optional(),
  title: z.string().trim().optional(),
  saveItinerary: z.boolean().default(false),
});

export type GenerateItineraryDto = z.infer<typeof GenerateItineraryDtoSchema>;

export interface GeneratedItineraryResponse {
  itinerary: ItineraryDto;
  summary: {
    totalDays: number;
    totalStops: number;
    totalEstimatedBudget: number;
    budgetPerPerson: number;
    travelStyle: TravelStyle;
    travelPace: TravelPace;
    transportation: TransportationType;
    optimizedRouteNotes: string;
  };
}
