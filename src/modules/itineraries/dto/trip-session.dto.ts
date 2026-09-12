import { z } from 'zod';
import {
  TripSessionStatus,
  TripActivityStatus,
  TransportationMode,
  ItineraryItemType,
} from '@prisma/client';

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

export const SkipActivityDtoSchema = z.object({
  reason: z.string().max(255).optional(),
});

export type SkipActivityDto = z.infer<typeof SkipActivityDtoSchema>;

export const StartActivityDtoSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type StartActivityDto = z.infer<typeof StartActivityDtoSchema>;

export const StartTripDtoSchema = z.object({
  itineraryId: z.string().optional(),
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

export interface ActivityDestinationSummaryDto {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface TripActivityDto {
  id: string; // references ItineraryItem.id
  progressId: string;
  title: string;
  itemType: ItineraryItemType;
  sequence: number; // 1-indexed for display
  orderIndex: number;
  dayNumber: number;
  status: TripActivityStatus;
  destinationId: string | null;
  restaurantId: string | null;
  accommodationId: string | null;
  destination: ActivityDestinationSummaryDto | null;
  latitude: number | null;
  longitude: number | null;
  arrivalRadiusMeters: number;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
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

export interface TripRouteLegRecordDto {
  id: string;
  fromActivityId: string | null;
  toActivityId: string;
  legOrder: number;
  distanceMeters: number;
  durationSeconds: number;
  geometry: string; // Encoded Polyline6
}

export interface TripRouteDto {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  polyline: string | null;
  legs: TripRouteLegDto[];
}

export interface StartTripResponseDto {
  tripSession: TripSessionDto;
  session: TripSessionDto; // Alias for backward compatibility
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
  routes: TripRouteLegRecordDto[]; // Per-leg Directions API geometry records
  route: TripRouteDto; // Aggregated summary
  progressPercentage: number;
}

export type ActiveTripSessionResponseDto = StartTripResponseDto;

export const TRIP_ERROR_CODES = {
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
  TRIP_ALREADY_ACTIVE: 'TRIP_ALREADY_ACTIVE',
  TRIP_NOT_ACTIVE: 'TRIP_NOT_ACTIVE',
  INVALID_ACTIVITY: 'INVALID_ACTIVITY',
  ACTIVITY_NOT_IN_TRIP: 'ACTIVITY_NOT_IN_TRIP',
  INVALID_ACTIVITY_TRANSITION: 'INVALID_ACTIVITY_TRANSITION',
  ROUTE_CALCULATION_FAILED: 'ROUTE_CALCULATION_FAILED',
  MAPBOX_DIRECTIONS_ERROR: 'MAPBOX_DIRECTIONS_ERROR',
  ITINERARY_EDIT_CONFLICT: 'ITINERARY_EDIT_CONFLICT',
  UNAUTHORIZED_TRIP_ACCESS: 'UNAUTHORIZED_TRIP_ACCESS',
} as const;
