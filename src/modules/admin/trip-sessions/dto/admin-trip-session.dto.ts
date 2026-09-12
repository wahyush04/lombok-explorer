import { z } from 'zod';
import { TripSessionStatus } from '@prisma/client';

export const AdminTripSessionFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.nativeEnum(TripSessionStatus).optional(),
  userId: z.string().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sortBy: z
    .enum(['startedAt', 'endedAt', 'createdAt'])
    .default('startedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminTripSessionFilterQuery = z.infer<typeof AdminTripSessionFilterQuerySchema>;

export interface AdminTripSessionListItemDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  itineraryId: string;
  itineraryTitle: string;
  status: TripSessionStatus;
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationAt: Date | null;
  totalActivitiesCount: number;
  completedActivitiesCount: number;
  createdAt: Date;
}

export interface AdminLiveMapPointDto {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  itineraryId: string;
  itineraryTitle: string;
  status: TripSessionStatus;
  latitude: number;
  longitude: number;
  lastLocationAt: Date;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}
