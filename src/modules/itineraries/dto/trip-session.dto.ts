import { z } from 'zod';
import { TripSessionStatus, TripActivityStatus, TransportationMode, ItineraryItemType } from '@prisma/client';

export const SyncLocationDtoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  activityId: z.string().uuid().optional(),
  arrivalDetected: z.boolean().optional(),
});

export type SyncLocationDto = z.infer<typeof SyncLocationDtoSchema>;

export const CompleteActivityDtoSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nonnegative().optional(),
});

export type CompleteActivityDto = z.infer<typeof CompleteActivityDtoSchema>;

export const StartTripDtoSchema = z.object({
  itineraryId: z.string().uuid().optional(),
  initialLatitude: z.number().min(-90).max(90).optional(),
  initialLongitude: z.number().min(-180).max(180).optional(),
});

export type StartTripDto = z.infer<typeof StartTripDtoSchema>;

export interface TripSessionDto {
  id: string;
  userId: string;
  itineraryId: string;
  status: TripSessionStatus;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  currentActivityId: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracy: number | null;
  lastLocationAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripActivityDto {
  id: string; // references ItineraryItem.id
  progressId: string;
  title: string;
  itemType: ItineraryItemType;
  destinationId: string | null;
  restaurantId: string | null;
  accommodationId: string | null;
  dayNumber: number;
  orderIndex: number;
  status: TripActivityStatus;
  latitude: number | null;
  longitude: number | null;
  arrivalRadiusMeters: number;
  startedAt: string | null;
  completedAt: string | null;
  arrivalDetectedAt: string | null;
  activityNotes: string | null;
  estimatedDurationMinutes: number;
}

export interface TripRouteLegDto {
  fromActivityId: string | null;
  toActivityId: string | null;
  distanceKm: number;
  durationMinutes: number;
  polyline: string | null;
}

export interface TripRouteDto {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  polyline: string | null;
  legs: TripRouteLegDto[];
}

export interface StartTripResponseDto {
  session: TripSessionDto;
  itinerary: {
    id: string;
    title: string;
    transportationMode: TransportationMode;
    totalDays: number;
    totalDistanceKm: number;
    totalTravelTimeMinutes: number;
  };
  activities: TripActivityDto[];
  currentActivity: TripActivityDto | null;
  nextActivities: TripActivityDto[];
  route: TripRouteDto;
  progressPercentage: number;
}

export type ActiveTripSessionResponseDto = StartTripResponseDto;
