import { TripActivityStatus, TripRoute, TripSessionStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { logger } from '../../common/utils/logger';
import { mapboxDirectionsService } from './services/mapbox-directions.service';
import { DirectionsRouteResult, GeoCoordinate, IMapboxDirectionsService } from './services/mapbox.types';
import {
  TripSessionsRepository,
  tripSessionsRepository,
  CreateProgressItemInput,
  CreateTripRouteLegInput,
} from './trip-sessions.repository';
import {
  ActiveTripSessionResponseDto,
  CompleteActivityDto,
  SkipActivityDto,
  StartActivityDto,
  StartTripDto,
  StartTripResponseDto,
  SyncLocationDto,
  TRIP_ERROR_CODES,
  TripActivityDto,
  TripRouteDto,
  TripRouteLegRecordDto,
  TripSessionDto,
} from './dto/trip-session.dto';

interface ProgressItemRecord {
  id: string;
  tripSessionId?: string;
  itineraryActivityId: string;
  status: TripActivityStatus;
  orderIndex?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  skippedAt?: Date | null;
  arrivalDetectedAt?: Date | null;
}

interface ActivityLocationItem {
  id: string;
  destination?: { id: string; name: string; latitude: number; longitude: number } | null;
  restaurant?: { id: string; name: string; latitude: number; longitude: number } | null;
  accommodation?: { id: string; name: string; latitude: number; longitude: number } | null;
  customLocation?: string | null;
  customTitle?: string | null;
}

export class TripSessionsService {
  private readonly defaultArrivalRadiusMeters: number;

  constructor(
    private readonly repository: TripSessionsRepository = tripSessionsRepository,
    private readonly directionsService: IMapboxDirectionsService = mapboxDirectionsService,
    arrivalRadiusMeters?: number,
  ) {
    this.defaultArrivalRadiusMeters =
      arrivalRadiusMeters || Number(process.env.TRIP_ARRIVAL_RADIUS_METERS) || 100;
  }

  /**
   * Helper to extract geo-coordinate from an itinerary activity item.
   */
  private extractItemCoordinate(item: ActivityLocationItem): GeoCoordinate | null {
    if (item.destination?.latitude !== undefined && item.destination?.longitude !== undefined) {
      return {
        id: item.id,
        name: item.destination.name,
        latitude: item.destination.latitude,
        longitude: item.destination.longitude,
      };
    }

    if (item.restaurant?.latitude !== undefined && item.restaurant?.longitude !== undefined) {
      return {
        id: item.id,
        name: item.restaurant.name,
        latitude: item.restaurant.latitude,
        longitude: item.restaurant.longitude,
      };
    }

    if (item.accommodation?.latitude !== undefined && item.accommodation?.longitude !== undefined) {
      return {
        id: item.id,
        name: item.accommodation.name,
        latitude: item.accommodation.latitude,
        longitude: item.accommodation.longitude,
      };
    }

    if (item.customLocation) {
      try {
        const parsed = JSON.parse(item.customLocation) as {
          latitude?: number;
          longitude?: number;
          name?: string;
        };
        if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
          return {
            id: item.id,
            name: parsed.name || item.customTitle || 'Custom Location',
            latitude: Number(parsed.latitude),
            longitude: Number(parsed.longitude),
          };
        }
      } catch {
        // Fall through
      }
    }

    return null;
  }

  /**
   * Helper to calculate Haversine distance in kilometers.
   */
  public calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Builds client-facing DTO from session, itinerary, progress items, and routes.
   */
  private buildResponseDto(
    session: {
      id: string;
      userId: string;
      itineraryId: string;
      status: TripSessionStatus;
      startedAt: Date;
      endedAt: Date | null;
      pausedAt: Date | null;
      currentActivityId: string | null;
      lastLatitude: number | null;
      lastLongitude: number | null;
      lastAccuracy: number | null;
      lastLocationAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      routeSnapshot: string | null;
    },
    itinerary: {
      id: string;
      title: string;
      transportationMode: import('@prisma/client').TransportationMode;
      totalDays: number;
      totalDistanceKm: number | { toNumber(): number } | null;
      totalTravelTimeMinutes: number | null;
      days: {
        id: string;
        dayNumber: number;
        items: {
          id: string;
          itemType: import('@prisma/client').ItineraryItemType;
          destinationId: string | null;
          restaurantId: string | null;
          accommodationId: string | null;
          customTitle: string | null;
          activityNotes: string | null;
          estimatedDurationMinutes: number;
          destination?: { id: string; name: string; latitude: number; longitude: number } | null;
          restaurant?: { id: string; name: string; latitude: number; longitude: number } | null;
          accommodation?: { id: string; name: string; latitude: number; longitude: number } | null;
          customLocation?: string | null;
        }[];
      }[];
    },
    progressList: {
      id: string;
      itineraryActivityId: string;
      status: TripActivityStatus;
      orderIndex: number;
      startedAt: Date | null;
      completedAt: Date | null;
      skippedAt?: Date | null;
      arrivalDetectedAt: Date | null;
    }[],
    routesList?: TripRoute[] | null,
    calculatedRoute?: TripRouteDto | null,
  ): StartTripResponseDto {
    const progressMap = new Map(progressList.map((p) => [p.itineraryActivityId, p]));

    // Flatten all items from sorted days
    const flattenedActivities: TripActivityDto[] = [];
    let completedCount = 0;

    for (const day of itinerary.days) {
      for (const item of day.items) {
        const prog = progressMap.get(item.id);
        const status = prog?.status || 'NOT_STARTED';
        if (status === 'COMPLETED') {
          completedCount++;
        }

        const coord = this.extractItemCoordinate(item);
        const title =
          item.destination?.name ||
          item.restaurant?.name ||
          item.accommodation?.name ||
          item.customTitle ||
          'Activity';

        flattenedActivities.push({
          id: item.id,
          progressId: prog?.id || '',
          title,
          itemType: item.itemType,
          sequence: 0, // Will assign 1-indexed sequence after sort
          orderIndex: prog?.orderIndex ?? 0,
          dayNumber: day.dayNumber,
          status,
          destinationId: item.destinationId,
          restaurantId: item.restaurantId,
          accommodationId: item.accommodationId,
          destination: item.destination
            ? {
                id: item.destination.id,
                name: item.destination.name,
                latitude: item.destination.latitude,
                longitude: item.destination.longitude,
              }
            : null,
          latitude: coord ? coord.latitude : null,
          longitude: coord ? coord.longitude : null,
          arrivalRadiusMeters: this.defaultArrivalRadiusMeters,
          startedAt: prog?.startedAt ? prog.startedAt.toISOString() : null,
          completedAt: prog?.completedAt ? prog.completedAt.toISOString() : null,
          skippedAt: prog?.skippedAt ? prog.skippedAt.toISOString() : null,
          arrivalDetectedAt: prog?.arrivalDetectedAt ? prog.arrivalDetectedAt.toISOString() : null,
          activityNotes: item.activityNotes,
          estimatedDurationMinutes: item.estimatedDurationMinutes,
        });
      }
    }

    // Sort flattened by orderIndex and assign 1-based sequence
    flattenedActivities.sort((a, b) => a.orderIndex - b.orderIndex);
    flattenedActivities.forEach((act, idx) => {
      act.sequence = idx + 1;
    });

    // Identify current and next activities
    const currentActivity =
      session.currentActivityId !== null
        ? flattenedActivities.find((a) => a.id === session.currentActivityId) || null
        : null;

    const nextActivities = flattenedActivities.filter(
      (a) => a.status === 'NOT_STARTED' && a.id !== session.currentActivityId,
    );

    // Build routes array from persisted TripRoute records
    const routesRecords: TripRouteLegRecordDto[] = (routesList || []).map((r) => ({
      id: r.id,
      fromActivityId: r.fromActivityId,
      toActivityId: r.toActivityId,
      legOrder: r.legOrder,
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      geometry: r.geometry,
    }));

    // Build route summary
    let routeSummary: TripRouteDto = {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      polyline: null,
      legs: [],
    };

    if (calculatedRoute) {
      routeSummary = calculatedRoute;
    } else if (session.routeSnapshot) {
      try {
        routeSummary = JSON.parse(session.routeSnapshot) as TripRouteDto;
      } catch {
        // Fall back to empty summary
      }
    } else if (routesRecords.length > 0) {
      const totalDistMeters = routesRecords.reduce((acc, r) => acc + r.distanceMeters, 0);
      const totalDurSeconds = routesRecords.reduce((acc, r) => acc + r.durationSeconds, 0);
      routeSummary = {
        totalDistanceKm: Math.round((totalDistMeters / 1000) * 10) / 10,
        totalDurationMinutes: Math.round(totalDurSeconds / 60),
        polyline: routesRecords[0]?.geometry || null,
        legs: routesRecords.map((r) => ({
          fromActivityId: r.fromActivityId,
          toActivityId: r.toActivityId,
          distanceKm: Math.round((r.distanceMeters / 1000) * 10) / 10,
          durationMinutes: Math.round(r.durationSeconds / 60),
          polyline: r.geometry,
        })),
      };
    }

    const totalActivities = flattenedActivities.length;
    const progressPercentage =
      totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

    const rawDistance =
      typeof itinerary.totalDistanceKm === 'object' && itinerary.totalDistanceKm !== null
        ? itinerary.totalDistanceKm.toNumber()
        : Number(itinerary.totalDistanceKm) || 0;

    const sessionDto: TripSessionDto = {
      id: session.id,
      userId: session.userId,
      itineraryId: session.itineraryId,
      status: session.status,
      startedAt: session.startedAt instanceof Date ? session.startedAt.toISOString() : new Date(session.startedAt || Date.now()).toISOString(),
      endedAt: session.endedAt ? (session.endedAt instanceof Date ? session.endedAt.toISOString() : new Date(session.endedAt).toISOString()) : null,
      pausedAt: session.pausedAt ? (session.pausedAt instanceof Date ? session.pausedAt.toISOString() : new Date(session.pausedAt).toISOString()) : null,
      currentActivityId: session.currentActivityId ?? null,
      lastLatitude: session.lastLatitude ?? null,
      lastLongitude: session.lastLongitude ?? null,
      lastAccuracy: session.lastAccuracy ?? null,
      lastLocationAt: session.lastLocationAt ? (session.lastLocationAt instanceof Date ? session.lastLocationAt.toISOString() : new Date(session.lastLocationAt).toISOString()) : null,
      createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : new Date(session.createdAt || Date.now()).toISOString(),
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : new Date(session.updatedAt || Date.now()).toISOString(),
    };

    return {
      tripSession: sessionDto,
      session: sessionDto,
      itinerary: {
        id: itinerary.id,
        title: itinerary.title,
        transportationMode: itinerary.transportationMode,
        totalDays: itinerary.totalDays,
        totalDistanceKm: rawDistance,
        totalTravelTimeMinutes: itinerary.totalTravelTimeMinutes || 0,
      },
      activities: flattenedActivities,
      currentActivity,
      nextActivities,
      routes: routesRecords,
      route: routeSummary,
      progressPercentage,
    };
  }

  /**
   * Starts a new trip session or recovers an existing active session.
   * Calculates real road directions via Mapbox Directions API and persists TripRoute per-leg records.
   */
  public async startTrip(
    userId: string,
    itineraryId: string,
    dto?: StartTripDto,
  ): Promise<StartTripResponseDto> {
    // 1. Resolve & validate itinerary ownership and presence
    let resolvedItineraryId = itineraryId;
    if (
      !resolvedItineraryId ||
      resolvedItineraryId === 'active' ||
      resolvedItineraryId === 'active-trip' ||
      resolvedItineraryId === 'undefined'
    ) {
      const activeTrip = await prisma.itinerary.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (!activeTrip) {
        throw new NotFoundError('Tidak ada trip plan aktif yang ditemukan', 'NO_ACTIVE_TRIP');
      }
      resolvedItineraryId = activeTrip.id;
    }

    const itinerary = typeof prisma.itinerary.findFirst === 'function'
      ? await prisma.itinerary.findFirst({
          where: { id: resolvedItineraryId, deletedAt: null },
          include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                    locationName: true,
                  },
                },
                restaurant: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                  },
                },
                accommodation: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                  },
                },
              },
            },
          },
        },
      },
        })
      : await prisma.itinerary.findUnique({
          where: { id: resolvedItineraryId },
          include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                    locationName: true,
                  },
                },
                restaurant: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                  },
                },
                accommodation: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    address: true,
                  },
                },
              },
            },
          },
        },
      },
        });

    if (!itinerary || (itinerary as any).deletedAt !== null) {
      throw new NotFoundError(`Itinerary with id '${resolvedItineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to start a trip for this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    // 2. Check if user already has an active session
    const existingUserActive = await this.repository.findActiveSessionByUserId(userId);
    if (existingUserActive) {
      // Auto-heal: jika itinerary sesi aktif sudah dihapus (soft-delete atau null), batalkan sesi orphaned
      const isOrphaned =
        existingUserActive.itinerary === null ||
        (existingUserActive.itinerary !== undefined && (existingUserActive.itinerary as any).deletedAt !== null);

      if (isOrphaned) {
        await this.repository.updateSession(existingUserActive.id, {
          status: 'CANCELLED',
          endedAt: new Date(),
          currentActivityId: null,
        });
      } else if (existingUserActive.itineraryId === resolvedItineraryId) {
        // Return existing active session for this itinerary
        const fullExisting =
          (await this.repository.findById(existingUserActive.id)) || existingUserActive;
        if (fullExisting) {
          const existingItinerary =
            'itinerary' in fullExisting && fullExisting.itinerary
              ? (fullExisting.itinerary as typeof itinerary)
              : itinerary;
          return this.buildResponseDto(
            fullExisting,
            existingItinerary,
            fullExisting.activityProgress || [],
            fullExisting.routes || [],
          );
        }
      } else {
        // User already has an active session on another itinerary -> 409 Conflict with standardized payload
        throw new ConflictError(
          'Pengguna sudah memiliki perjalanan yang sedang aktif.',
          'ACTIVE_SESSION_EXISTS',
          null,
          {
            activeSessionId: existingUserActive.id,
            itineraryId: existingUserActive.itineraryId,
          },
        );
      }
    }

    const totalItems = itinerary.days.reduce((sum, d) => sum + d.items.length, 0);
    if (totalItems === 0) {
      throw new ValidationError(
        'Itinerary tidak memiliki aktivitas atau destinasi untuk dimulai.',
        null,
        'EMPTY_ITINERARY',
      );
    }

    // 4. Build initial progress items and identify first incomplete activity
    const progressItems: CreateProgressItemInput[] = [];
    let firstIncompleteActivityId: string | null = null;
    let globalIndex = 0;

    for (const day of itinerary.days) {
      for (const item of day.items) {
        const isAlreadyCompleted = item.isCompleted;
        let status: TripActivityStatus = 'NOT_STARTED';
        let startedAt: Date | null = null;
        const completedAt: Date | null = isAlreadyCompleted ? new Date() : null;

        if (isAlreadyCompleted) {
          status = 'COMPLETED';
        } else if (!firstIncompleteActivityId) {
          status = 'IN_PROGRESS';
          startedAt = new Date();
          firstIncompleteActivityId = item.id;
        }

        progressItems.push({
          itineraryActivityId: item.id,
          status,
          orderIndex: globalIndex++,
          startedAt,
          completedAt,
        });
      }
    }

    const sessionStatus: TripSessionStatus =
      firstIncompleteActivityId === null ? 'COMPLETED' : 'ACTIVE';

    // 5. Gather activity coordinates for route calculation
    const coordinates: GeoCoordinate[] = [];
    if (dto?.initialLatitude !== undefined && dto?.initialLongitude !== undefined) {
      coordinates.push({
        id: 'start_pos',
        name: 'Start Position',
        latitude: dto.initialLatitude,
        longitude: dto.initialLongitude,
      });
    }

    for (const day of itinerary.days) {
      for (const item of day.items) {
        const c = this.extractItemCoordinate(item);
        if (c) coordinates.push(c);
      }
    }

    // 6. Calculate Directions route outside database transaction
    let directionsResult: DirectionsRouteResult = {
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      geometry: '',
      legs: [],
    };

    try {
      directionsResult = await this.directionsService.getRoutesForActivities(
        coordinates,
        itinerary.transportationMode,
      );
    } catch (err) {
      logger.warn({ err }, 'Directions service failed during startTrip. Falling back.');
    }

    const routeLegsInputs: CreateTripRouteLegInput[] = directionsResult.legs.map((leg, index) => ({
      fromActivityId: leg.fromActivityId,
      toActivityId: leg.toActivityId,
      legOrder: leg.legOrder ?? index,
      distanceMeters: leg.distanceMeters,
      durationSeconds: leg.durationSeconds,
      geometry: leg.geometry,
    }));

    const routeSnapshot = JSON.stringify({
      totalDistanceKm: Math.round((directionsResult.totalDistanceMeters / 1000) * 10) / 10,
      totalDurationMinutes: Math.round(directionsResult.totalDurationSeconds / 60),
      polyline: directionsResult.geometry,
      legs: directionsResult.legs.map((l) => ({
        fromActivityId: l.fromActivityId,
        toActivityId: l.toActivityId,
        distanceKm: Math.round((l.distanceMeters / 1000) * 10) / 10,
        durationMinutes: Math.round(l.durationSeconds / 60),
        polyline: l.geometry,
      })),
    });

    // 7. Persist session, progress, and route legs atomically
    const createdSession = await this.repository.createSession(
      {
        userId,
        itineraryId: resolvedItineraryId,
        status: sessionStatus,
        currentActivityId: firstIncompleteActivityId,
        routeSnapshot,
        lastLatitude: dto?.initialLatitude || null,
        lastLongitude: dto?.initialLongitude || null,
        lastAccuracy: null,
        lastLocationAt: dto?.initialLatitude ? new Date() : null,
      },
      progressItems,
      routeLegsInputs,
    );

    return this.buildResponseDto(
      createdSession,
      itinerary,
      createdSession.activityProgress,
      createdSession.routes,
    );
  }

  /**
   * Recovers the active trip session for the authenticated user.
   */
  public async getActiveSession(userId: string): Promise<ActiveTripSessionResponseDto | null> {
    const session = await this.repository.findActiveSessionByUserId(userId);
    if (!session) return null;

    // Item 2: Sanitasi validasi & Auto-heal
    // Jika itinerary sudah dihapus (soft-delete atau null), batalkan sesi orphaned dan kembalikan null
    const isOrphaned =
      session.itinerary === null ||
      (session.itinerary !== undefined && (session.itinerary as any).deletedAt !== null);

    if (isOrphaned) {
      await this.repository.updateSession(session.id, {
        status: 'CANCELLED',
        endedAt: new Date(),
        currentActivityId: null,
      });
      return null;
    }

    return this.buildResponseDto(
      session,
      session.itinerary,
      session.activityProgress,
      session.routes,
    );
  }

  /**
   * Retrieves a trip session by its ID.
   */
  public async getSessionById(userId: string, sessionId: string): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to view this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.buildResponseDto(
      session,
      session.itinerary,
      session.activityProgress,
      session.routes,
    );
  }

  /**
   * Explicitly starts an activity (transitions NOT_STARTED -> IN_PROGRESS).
   */
  public async startActivity(
    userId: string,
    sessionId: string,
    activityId: string,
    dto?: StartActivityDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Trip session is not active', null, TRIP_ERROR_CODES.TRIP_NOT_ACTIVE);
    }

    const progress = await this.repository.findProgressBySessionAndActivity(sessionId, activityId);
    if (!progress) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in this trip session`,
        TRIP_ERROR_CODES.ACTIVITY_NOT_IN_TRIP,
      );
    }

    // Idempotent: if already IN_PROGRESS, return current state
    if (progress.status === 'IN_PROGRESS') {
      return this.buildResponseDto(
        session,
        session.itinerary,
        session.activityProgress,
        session.routes,
      );
    }

    if (progress.status === 'COMPLETED' || progress.status === 'SKIPPED') {
      throw new ValidationError(
        `Cannot start activity with status '${progress.status}'`,
        null,
        TRIP_ERROR_CODES.INVALID_ACTIVITY_TRANSITION,
      );
    }

    const now = new Date();
    await this.repository.updateProgress(progress.id, {
      status: 'IN_PROGRESS',
      startedAt: now,
      ...(dto?.latitude !== undefined && { lastLatitude: dto.latitude }),
      ...(dto?.longitude !== undefined && { lastLongitude: dto.longitude }),
    });

    await this.repository.updateSession(sessionId, {
      currentActivityId: activityId,
      ...(dto?.latitude !== undefined && { lastLatitude: dto.latitude }),
      ...(dto?.longitude !== undefined && { lastLongitude: dto.longitude }),
      lastLocationAt: now,
    });

    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Explicitly marks an activity as completed.
   * Synchronizes ItineraryItem.isCompleted and advances currentActivityId.
   */
  public async completeActivity(
    userId: string,
    sessionId: string,
    activityId: string,
    dto?: CompleteActivityDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Trip session is not active', null, TRIP_ERROR_CODES.TRIP_NOT_ACTIVE);
    }

    const progress = await this.repository.findProgressBySessionAndActivity(sessionId, activityId);
    if (!progress) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in this trip session`,
        TRIP_ERROR_CODES.ACTIVITY_NOT_IN_TRIP,
      );
    }

    // Idempotent: if already completed, return current state
    if (progress.status === 'COMPLETED') {
      return this.buildResponseDto(
        session,
        session.itinerary,
        session.activityProgress,
        session.routes,
      );
    }

    const now = new Date();

    // 1. Mark progress item as COMPLETED
    await this.repository.updateProgress(progress.id, {
      status: 'COMPLETED',
      completedAt: now,
      ...(dto?.latitude !== undefined && { lastLatitude: dto.latitude }),
      ...(dto?.longitude !== undefined && { lastLongitude: dto.longitude }),
      ...(dto?.accuracy !== undefined && { lastAccuracy: dto.accuracy }),
    });

    // 2. Synchronize ItineraryItem.isCompleted
    await prisma.itineraryItem.update({
      where: { id: activityId },
      data: { isCompleted: true },
    });

    // 3. Advance currentActivityId to the next NOT_STARTED activity
    const allProgress = await this.repository.findProgressListBySession(sessionId);
    const nextProgress = allProgress.find(
      (p: ProgressItemRecord) =>
        p.status === 'NOT_STARTED' && p.itineraryActivityId !== activityId,
    );

    const sessionUpdate: {
      currentActivityId?: string | null;
      status?: TripSessionStatus;
      endedAt?: Date;
      lastLatitude?: number;
      lastLongitude?: number;
      lastAccuracy?: number;
      lastLocationAt?: Date;
    } = {
      ...(dto?.latitude !== undefined && { lastLatitude: dto.latitude }),
      ...(dto?.longitude !== undefined && { lastLongitude: dto.longitude }),
      ...(dto?.accuracy !== undefined && { lastAccuracy: dto.accuracy }),
      lastLocationAt: now,
    };

    if (nextProgress) {
      await this.repository.updateProgress(nextProgress.id, {
        status: 'IN_PROGRESS',
        startedAt: now,
      });
      sessionUpdate.currentActivityId = nextProgress.itineraryActivityId;
    } else {
      // Check if all activities are completed or skipped
      const remainingUnfinished = allProgress.filter(
        (p: ProgressItemRecord) =>
          p.itineraryActivityId !== activityId &&
          p.status !== 'COMPLETED' &&
          p.status !== 'SKIPPED',
      );

      if (remainingUnfinished.length === 0) {
        sessionUpdate.currentActivityId = null;
        sessionUpdate.status = 'COMPLETED';
        sessionUpdate.endedAt = now;
      }
    }

    await this.repository.updateSession(sessionId, sessionUpdate);
    const refreshed = (await this.repository.findById(sessionId))!;

    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Skips an activity in the active trip session.
   */
  public async skipActivity(
    userId: string,
    sessionId: string,
    activityId: string,
    _dto?: SkipActivityDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Trip session is not active', null, TRIP_ERROR_CODES.TRIP_NOT_ACTIVE);
    }

    const progress = await this.repository.findProgressBySessionAndActivity(sessionId, activityId);
    if (!progress) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in this trip session`,
        TRIP_ERROR_CODES.ACTIVITY_NOT_IN_TRIP,
      );
    }

    // Idempotent: if already skipped, return current state
    if (progress.status === 'SKIPPED') {
      return this.buildResponseDto(
        session,
        session.itinerary,
        session.activityProgress,
        session.routes,
      );
    }

    const now = new Date();
    await this.repository.updateProgress(progress.id, {
      status: 'SKIPPED',
      skippedAt: now,
    });

    // Advance currentActivityId to the next NOT_STARTED activity
    const allProgress = await this.repository.findProgressListBySession(sessionId);
    const nextProgress = allProgress.find(
      (p: ProgressItemRecord) =>
        p.status === 'NOT_STARTED' && p.itineraryActivityId !== activityId,
    );

    const sessionUpdate: {
      currentActivityId?: string | null;
      status?: TripSessionStatus;
      endedAt?: Date;
    } = {};

    if (nextProgress) {
      await this.repository.updateProgress(nextProgress.id, {
        status: 'IN_PROGRESS',
        startedAt: now,
      });
      sessionUpdate.currentActivityId = nextProgress.itineraryActivityId;
    } else {
      const remainingUnfinished = allProgress.filter(
        (p: ProgressItemRecord) =>
          p.itineraryActivityId !== activityId &&
          p.status !== 'COMPLETED' &&
          p.status !== 'SKIPPED',
      );

      if (remainingUnfinished.length === 0) {
        sessionUpdate.currentActivityId = null;
        sessionUpdate.status = 'COMPLETED';
        sessionUpdate.endedAt = now;
      }
    }

    await this.repository.updateSession(sessionId, sessionUpdate);
    const refreshed = (await this.repository.findById(sessionId))!;

    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Synchronizes location from mobile client.
   * DOES NOT call Directions API on every GPS update (strictly enforces Phase 11).
   * Automatically handles arrival auto-completion if arrivalDetected flag is sent.
   */
  public async syncLocation(
    userId: string,
    sessionId: string,
    dto: SyncLocationDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Trip session is not active', null, TRIP_ERROR_CODES.TRIP_NOT_ACTIVE);
    }

    const now = new Date();
    const updateData: {
      lastLatitude: number;
      lastLongitude: number;
      lastAccuracy?: number | null;
      lastLocationAt: Date;
      currentActivityId?: string | null;
      status?: TripSessionStatus;
      endedAt?: Date;
    } = {
      lastLatitude: dto.latitude,
      lastLongitude: dto.longitude,
      lastAccuracy: dto.accuracy ?? null,
      lastLocationAt: now,
    };

    // Auto-arrival detection trigger
    const targetActivityId = dto.activityId || session.currentActivityId;
    if (dto.arrivalDetected && targetActivityId) {
      // Validate proximity to prevent spoofing or premature arrival
      let targetItem: ActivityLocationItem | null = null;
      const itineraryObj = session.itinerary as { days?: { items?: ActivityLocationItem[] }[] } | null;
      for (const d of itineraryObj?.days || []) {
        const found = d.items?.find((i: ActivityLocationItem) => i.id === targetActivityId);
        if (found) {
          targetItem = found;
          break;
        }
      }

      if (targetItem) {
        const coord = this.extractItemCoordinate(targetItem);
        if (coord) {
          const distKm = this.calculateHaversineKm(dto.latitude, dto.longitude, coord.latitude, coord.longitude);
          const arrivalRadiusKm = this.defaultArrivalRadiusMeters / 1000;
          if (distKm > arrivalRadiusKm * 1.5) {
            throw new ValidationError(
              `User location is too far from activity destination (${(distKm * 1000).toFixed(0)}m > ${this.defaultArrivalRadiusMeters}m)`,
              null,
              TRIP_ERROR_CODES.INVALID_ACTIVITY_TRANSITION,
            );
          }
        }
      }

      const progress = await this.repository.findProgressBySessionAndActivity(
        sessionId,
        targetActivityId,
      );

      if (progress && progress.status !== 'COMPLETED') {
        await this.repository.updateProgress(progress.id, {
          status: 'COMPLETED',
          completedAt: now,
          arrivalDetectedAt: now,
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastAccuracy: dto.accuracy ?? null,
        });

        await prisma.itineraryItem.update({
          where: { id: targetActivityId },
          data: { isCompleted: true },
        });

        const allProgress = (await this.repository.findProgressListBySession(sessionId)) || [];
        const nextProgress = allProgress.find(
          (p: ProgressItemRecord) =>
            p.status === 'NOT_STARTED' && p.itineraryActivityId !== targetActivityId,
        );

        if (nextProgress) {
          await this.repository.updateProgress(nextProgress.id, {
            status: 'IN_PROGRESS',
            startedAt: now,
          });
          updateData.currentActivityId = nextProgress.itineraryActivityId;
        } else {
          updateData.currentActivityId = null;
          updateData.status = 'COMPLETED';
          updateData.endedAt = now;
        }
      }
    }

    await this.repository.updateSession(sessionId, updateData);
    const refreshed = (await this.repository.findById(sessionId))!;

    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Manually marks the trip session as finished.
   */
  public async finishTrip(userId: string, sessionId: string): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to finish this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status === 'COMPLETED') {
      return this.buildResponseDto(
        session,
        session.itinerary,
        session.activityProgress,
        session.routes,
      );
    }

    const now = new Date();
    await this.repository.updateSession(sessionId, {
      status: 'COMPLETED',
      endedAt: now,
      currentActivityId: null,
    });

    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Cancels the active trip session.
   */
  public async cancelTrip(userId: string, sessionId: string): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, TRIP_ERROR_CODES.TRIP_NOT_FOUND);
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to cancel this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    const now = new Date();
    await this.repository.updateSession(sessionId, {
      status: 'CANCELLED',
      endedAt: now,
      currentActivityId: null,
    });

    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(
      refreshed,
      refreshed.itinerary,
      refreshed.activityProgress,
      refreshed.routes,
    );
  }

  /**
   * Reconciles an active TripSession whenever an itinerary is modified.
   * NEVER blocks itinerary edits. Preserves completed progress, updates order,
   * ensures currentActivityId never references a deleted activity, and refreshes route legs.
   */
  public async reconcileItineraryChange(itineraryId: string): Promise<void> {
    try {
      const activeSession = await this.repository.findActiveSessionByItineraryId(itineraryId);
      if (!activeSession) {
        return; // No active session to reconcile
      }

      const freshItinerary = await prisma.itinerary.findUnique({
        where: { id: itineraryId },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    select: { id: true, name: true, latitude: true, longitude: true },
                  },
                  restaurant: {
                    select: { id: true, name: true, latitude: true, longitude: true },
                  },
                  accommodation: {
                    select: { id: true, name: true, latitude: true, longitude: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!freshItinerary) {
        // Itinerary was completely deleted
        await this.repository.updateSession(activeSession.id, {
          status: 'COMPLETED',
          endedAt: new Date(),
          currentActivityId: null,
        });
        return;
      }

      // Collect current valid activity IDs in order
      const freshItemIds: string[] = [];
      const freshItemsMap = new Map<string, (typeof freshItinerary.days)[0]['items'][0]>();
      const coordinates: GeoCoordinate[] = [];

      // Preserve last user location if available
      if (activeSession.lastLatitude !== null && activeSession.lastLongitude !== null) {
        coordinates.push({
          id: 'last_known_pos',
          name: 'Current User Location',
          latitude: activeSession.lastLatitude,
          longitude: activeSession.lastLongitude,
        });
      }

      for (const day of freshItinerary.days) {
        for (const item of day.items) {
          freshItemIds.push(item.id);
          freshItemsMap.set(item.id, item);
          const c = this.extractItemCoordinate(item);
          if (c) coordinates.push(c);
        }
      }

      const existingProgress = await this.repository.findProgressListBySession(activeSession.id);
      const existingMap = new Map(existingProgress.map((p: ProgressItemRecord) => [p.itineraryActivityId, p]));

      // 1. Remove progress for activities deleted from the itinerary
      for (const prog of existingProgress) {
        if (!freshItemsMap.has(prog.itineraryActivityId)) {
          await this.repository.deleteProgress(activeSession.id, prog.itineraryActivityId);
        }
      }

      // 2. Add or re-index remaining activities
      const orderUpdates: { itineraryActivityId: string; orderIndex: number }[] = [];
      let globalIndex = 0;

      for (const itemId of freshItemIds) {
        const item = freshItemsMap.get(itemId)!;
        const existing = existingMap.get(itemId);

        if (!existing) {
          // New activity added to itinerary while trip was active
          await this.repository.upsertProgress(activeSession.id, itemId, {
            status: item.isCompleted ? 'COMPLETED' : 'NOT_STARTED',
            orderIndex: globalIndex,
          });
        } else {
          orderUpdates.push({ itineraryActivityId: itemId, orderIndex: globalIndex });
        }
        globalIndex++;
      }

      if (orderUpdates.length > 0) {
        await this.repository.updateProgressOrders(activeSession.id, orderUpdates);
      }

      // 3. Determine valid currentActivityId
      const refreshedProgress = await this.repository.findProgressListBySession(activeSession.id);
      const currentExists =
        activeSession.currentActivityId !== null &&
        freshItemsMap.has(activeSession.currentActivityId);

      let newCurrentActivityId = activeSession.currentActivityId;

      if (!currentExists) {
        const remainingProgress = (refreshedProgress || existingProgress).filter(
          (p: ProgressItemRecord) => freshItemsMap.has(p.itineraryActivityId),
        );
        const nextIncomplete = remainingProgress.find(
          (p: ProgressItemRecord) => p.status === 'NOT_STARTED' || p.status === 'IN_PROGRESS',
        );
        newCurrentActivityId = nextIncomplete ? nextIncomplete.itineraryActivityId : null;
        if (nextIncomplete && nextIncomplete.status === 'NOT_STARTED') {
          await this.repository.updateProgress(nextIncomplete.id, {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          });
        }
      }

      // 4. Invalidate & recalculate route legs via Directions API outside DB transaction
      let newRouteSnapshot = activeSession.routeSnapshot;
      let newRouteLegs: CreateTripRouteLegInput[] = [];

      if (coordinates.length >= 2) {
        try {
          const directionsResult = await this.directionsService.getRoutesForActivities(
            coordinates,
            freshItinerary.transportationMode,
          );

          newRouteLegs = directionsResult.legs.map((leg, index) => ({
            fromActivityId: leg.fromActivityId,
            toActivityId: leg.toActivityId,
            legOrder: leg.legOrder ?? index,
            distanceMeters: leg.distanceMeters,
            durationSeconds: leg.durationSeconds,
            geometry: leg.geometry,
          }));

          newRouteSnapshot = JSON.stringify({
            totalDistanceKm: Math.round((directionsResult.totalDistanceMeters / 1000) * 10) / 10,
            totalDurationMinutes: Math.round(directionsResult.totalDurationSeconds / 60),
            polyline: directionsResult.geometry,
            legs: directionsResult.legs.map((l) => ({
              fromActivityId: l.fromActivityId,
              toActivityId: l.toActivityId,
              distanceKm: Math.round((l.distanceMeters / 1000) * 10) / 10,
              durationMinutes: Math.round(l.durationSeconds / 60),
              polyline: l.geometry,
            })),
          });
        } catch (err) {
          logger.warn({ err }, 'Directions service recalculation failed during reconciliation.');
        }
      }

      // Persist replaced route legs atomically
      if (newRouteLegs.length > 0) {
        await this.repository.replaceRoutes(activeSession.id, newRouteLegs);
      }

      // 5. Update session state
      const allDone =
        refreshedProgress.length > 0 &&
        refreshedProgress.every((p: ProgressItemRecord) => p.status === 'COMPLETED' || p.status === 'SKIPPED');

      await this.repository.updateSession(activeSession.id, {
        currentActivityId: newCurrentActivityId,
        routeSnapshot: newRouteSnapshot,
        status: allDone ? 'COMPLETED' : 'ACTIVE',
        endedAt: allDone ? new Date() : null,
      });

      logger.info(`Reconciled active trip session ${activeSession.id} for itinerary ${itineraryId}`);
    } catch (err) {
      logger.error({ err }, `Failed to reconcile active trip session for itinerary ${itineraryId}`);
    }
  }
}

export const tripSessionsService = new TripSessionsService();
