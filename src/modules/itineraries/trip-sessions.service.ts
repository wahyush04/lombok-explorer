import { TripActivityStatus, TripSessionStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { logger } from '../../common/utils/logger';
import { mapboxMatrixService, MapboxMatrixService } from './services/mapbox-matrix.service';
import { GeoCoordinate } from './services/mapbox.types';
import {
  TripSessionsRepository,
  tripSessionsRepository,
  CreateProgressItemInput,
} from './trip-sessions.repository';
import {
  ActiveTripSessionResponseDto,
  CompleteActivityDto,
  StartTripDto,
  StartTripResponseDto,
  SyncLocationDto,
  TripActivityDto,
  TripRouteDto,
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
  arrivalDetectedAt?: Date | null;
}

export class TripSessionsService {
  private readonly defaultArrivalRadiusMeters: number;

  constructor(
    private readonly repository: TripSessionsRepository = tripSessionsRepository,
    private readonly matrixService: MapboxMatrixService = mapboxMatrixService,
    arrivalRadiusMeters?: number,
  ) {
    this.defaultArrivalRadiusMeters =
      arrivalRadiusMeters || Number(process.env.TRIP_ARRIVAL_RADIUS_METERS) || 100;
  }

  /**
   * Helper to extract geo-coordinate from an itinerary activity item.
   */
  private extractItemCoordinate(item: {
    id: string;
    destination?: { name: string; latitude: number; longitude: number } | null;
    restaurant?: { name: string; latitude: number; longitude: number } | null;
    accommodation?: { name: string; latitude: number; longitude: number } | null;
    customLocation?: string | null;
    customTitle?: string | null;
  }): GeoCoordinate | null {
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
   * Builds client-facing DTO from session, itinerary, and progress items.
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
          destination?: { name: string; latitude: number; longitude: number } | null;
          restaurant?: { name: string; latitude: number; longitude: number } | null;
          accommodation?: { name: string; latitude: number; longitude: number } | null;
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
      arrivalDetectedAt: Date | null;
    }[],
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
          destinationId: item.destinationId,
          restaurantId: item.restaurantId,
          accommodationId: item.accommodationId,
          dayNumber: day.dayNumber,
          orderIndex: prog?.orderIndex ?? 0,
          status,
          latitude: coord ? coord.latitude : null,
          longitude: coord ? coord.longitude : null,
          arrivalRadiusMeters: this.defaultArrivalRadiusMeters,
          startedAt: prog?.startedAt ? prog.startedAt.toISOString() : null,
          completedAt: prog?.completedAt ? prog.completedAt.toISOString() : null,
          arrivalDetectedAt: prog?.arrivalDetectedAt ? prog.arrivalDetectedAt.toISOString() : null,
          activityNotes: item.activityNotes,
          estimatedDurationMinutes: item.estimatedDurationMinutes,
        });
      }
    }

    // Sort flattened by orderIndex
    flattenedActivities.sort((a, b) => a.orderIndex - b.orderIndex);

    // Identify current and next activities
    const currentActivity =
      session.currentActivityId !== null
        ? flattenedActivities.find((a) => a.id === session.currentActivityId) || null
        : null;

    const nextActivities = flattenedActivities.filter(
      (a) => a.status === 'NOT_STARTED' && a.id !== session.currentActivityId,
    );

    let route: TripRouteDto = {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      polyline: null,
      legs: [],
    };

    if (calculatedRoute) {
      route = calculatedRoute;
    } else if (session.routeSnapshot) {
      try {
        route = JSON.parse(session.routeSnapshot) as TripRouteDto;
      } catch {
        // Fall back to default empty route
      }
    }

    const totalActivities = flattenedActivities.length;
    const progressPercentage =
      totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

    const sessionDto: TripSessionDto = {
      id: session.id,
      userId: session.userId,
      itineraryId: session.itineraryId,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      pausedAt: session.pausedAt ? session.pausedAt.toISOString() : null,
      currentActivityId: session.currentActivityId,
      lastLatitude: session.lastLatitude,
      lastLongitude: session.lastLongitude,
      lastAccuracy: session.lastAccuracy,
      lastLocationAt: session.lastLocationAt ? session.lastLocationAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };

    const totalDistNumber =
      typeof itinerary.totalDistanceKm === 'object' && itinerary.totalDistanceKm !== null
        ? itinerary.totalDistanceKm.toNumber()
        : Number(itinerary.totalDistanceKm) || 0;

    return {
      session: sessionDto,
      itinerary: {
        id: itinerary.id,
        title: itinerary.title,
        transportationMode: itinerary.transportationMode,
        totalDays: itinerary.totalDays,
        totalDistanceKm: Math.round(totalDistNumber * 10) / 10,
        totalTravelTimeMinutes: itinerary.totalTravelTimeMinutes || 0,
      },
      activities: flattenedActivities,
      currentActivity,
      nextActivities,
      route,
      progressPercentage,
    };
  }

  /**
   * Starts a new TripSession for the given itinerary.
   * Concurrency-safe: duplicate start on the same itinerary is idempotent.
   */
  public async startTrip(
    userId: string,
    itineraryId: string,
    dto?: StartTripDto,
  ): Promise<StartTripResponseDto> {
    // 1. Fetch itinerary with days and activities
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId },
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

    if (!itinerary || itinerary.deletedAt) {
      throw new NotFoundError(`Itinerary '${itineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to start a trip for this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    // 2. Check for existing active session for this user
    const existingActiveSession = await this.repository.findActiveSessionByUserId(userId);
    if (existingActiveSession) {
      if (existingActiveSession.itineraryId === itineraryId) {
        // Idempotent return: user already started this itinerary
        return this.buildResponseDto(
          existingActiveSession,
          existingActiveSession.itinerary,
          existingActiveSession.activityProgress,
        );
      } else {
        // Active session exists for a DIFFERENT itinerary
        throw new ConflictError(
          'Another trip session is currently active. Please complete or cancel it before starting a new trip.',
          'ACTIVE_TRIP_SESSION_EXISTS',
        );
      }
    }

    // 3. Verify itinerary has activities
    const allItems: import('@prisma/client').ItineraryItem[] = [];
    for (const day of itinerary.days) {
      for (const item of day.items) {
        allItems.push(item);
      }
    }

    if (allItems.length === 0) {
      throw new ValidationError('Cannot start a trip for an itinerary with no activities');
    }

    // 4. Build initial progress items
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

    // 5. Calculate route legs & polyline snapshot
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

    const routeCalc = await this.matrixService.calculateRouteLegsAndPolyline(
      coordinates,
      itinerary.transportationMode,
    );
    const routeSnapshot = JSON.stringify(routeCalc);

    // 6. Create session in database
    const createdSession = await this.repository.createSession(
      {
        userId,
        itineraryId,
        status: sessionStatus,
        currentActivityId: firstIncompleteActivityId,
        routeSnapshot,
        lastLatitude: dto?.initialLatitude || null,
        lastLongitude: dto?.initialLongitude || null,
        lastAccuracy: null,
        lastLocationAt: dto?.initialLatitude ? new Date() : null,
      },
      progressItems,
    );

    return this.buildResponseDto(
      createdSession,
      itinerary,
      createdSession.activityProgress,
      routeCalc,
    );
  }

  /**
   * Syncs active trip GPS location and evaluates arrival completion.
   */
  public async syncLocation(
    userId: string,
    sessionId: string,
    dto: SyncLocationDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to sync location for this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError(
        `Trip session is ${session.status.toLowerCase()} and cannot accept location updates`,
        ['SESSION_NOT_ACTIVE'],
      );
    }

    const now = new Date();
    const updateData: import('@prisma/client').Prisma.TripSessionUpdateInput = {
      lastLatitude: dto.latitude,
      lastLongitude: dto.longitude,
      lastAccuracy: dto.accuracy ?? null,
      lastLocationAt: now,
    };

    // Evaluate arrival detection
    if (dto.arrivalDetected) {
      const targetActivityId = dto.activityId || session.currentActivityId;
      if (!targetActivityId) {
        throw new ValidationError('No active activity to mark arrival for');
      }

      const progress = await this.repository.findProgressBySessionAndActivity(
        sessionId,
        targetActivityId,
      );
      if (!progress) {
        throw new NotFoundError(
          `Activity '${targetActivityId}' not found in this trip session`,
          'ACTIVITY_NOT_FOUND',
        );
      }

      // If already completed: safe idempotent return (offline retry)
      if (progress.status === 'COMPLETED') {
        await this.repository.updateSession(sessionId, updateData);
        const refreshed = (await this.repository.findById(sessionId))!;
        return this.buildResponseDto(refreshed, refreshed.itinerary, refreshed.activityProgress);
      }

      // Find activity coordinates to validate arrival
      let targetCoord: GeoCoordinate | null = null;
      for (const day of session.itinerary.days) {
        for (const item of day.items) {
          if (item.id === targetActivityId) {
            targetCoord = this.extractItemCoordinate(item);
            break;
          }
        }
      }

      if (targetCoord) {
        const distKm = this.matrixService.calculateHaversineKm(
          dto.latitude,
          dto.longitude,
          targetCoord.latitude,
          targetCoord.longitude,
        );
        const distMeters = distKm * 1000;
        const accuracyBuffer = Math.min(dto.accuracy ?? 0, 50);
        const threshold = this.defaultArrivalRadiusMeters + accuracyBuffer;

        if (distMeters > threshold) {
          throw new ValidationError(
            `User is ${Math.round(distMeters)}m away, which exceeds the arrival radius (${threshold}m)`,
            ['ARRIVAL_PROXIMITY_UNVERIFIED'],
          );
        }
      }

      // Proximity verified: Complete activity
      await this.repository.updateProgress(progress.id, {
        status: 'COMPLETED',
        completedAt: now,
        arrivalDetectedAt: now,
        lastLatitude: dto.latitude,
        lastLongitude: dto.longitude,
        lastAccuracy: dto.accuracy ?? null,
      });

      // Synchronize ItineraryItem.isCompleted
      await prisma.itineraryItem.update({
        where: { id: targetActivityId },
        data: { isCompleted: true },
      });

      // Advance currentActivityId to the next NOT_STARTED activity
      const allProgress = await this.repository.findProgressListBySession(sessionId);
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
        // All activities finished
        updateData.currentActivityId = null;
        updateData.status = 'COMPLETED';
        updateData.endedAt = now;
      }
    }

    await this.repository.updateSession(sessionId, updateData);
    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(refreshed, refreshed.itinerary, refreshed.activityProgress);
  }

  /**
   * Explicitly marks an activity as completed.
   */
  public async completeActivity(
    userId: string,
    sessionId: string,
    activityId: string,
    dto?: CompleteActivityDto,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to update this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new ValidationError('Trip session is not active');
    }

    const progress = await this.repository.findProgressBySessionAndActivity(sessionId, activityId);
    if (!progress) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in this trip session`,
        'ACTIVITY_NOT_FOUND',
      );
    }

    // Idempotent: if already completed, return current state
    if (progress.status === 'COMPLETED') {
      return this.buildResponseDto(session, session.itinerary, session.activityProgress);
    }

    // If coordinates are provided in DTO, validate distance
    if (dto?.latitude !== undefined && dto?.longitude !== undefined) {
      let targetCoord: GeoCoordinate | null = null;
      for (const day of session.itinerary.days) {
        for (const item of day.items) {
          if (item.id === activityId) {
            targetCoord = this.extractItemCoordinate(item);
            break;
          }
        }
      }

      if (targetCoord) {
        const distKm = this.matrixService.calculateHaversineKm(
          dto.latitude,
          dto.longitude,
          targetCoord.latitude,
          targetCoord.longitude,
        );
        const distMeters = distKm * 1000;
        const accuracyBuffer = Math.min(dto.accuracy ?? 0, 50);
        const threshold = this.defaultArrivalRadiusMeters + accuracyBuffer;

        if (distMeters > threshold) {
          throw new ValidationError(
            `User is ${Math.round(distMeters)}m away, exceeding arrival threshold (${threshold}m)`,
            ['ARRIVAL_PROXIMITY_UNVERIFIED'],
          );
        }
      }
    }

    const now = new Date();
    await this.repository.updateProgress(progress.id, {
      status: 'COMPLETED',
      completedAt: now,
      lastLatitude: dto?.latitude ?? null,
      lastLongitude: dto?.longitude ?? null,
      lastAccuracy: dto?.accuracy ?? null,
    });

    await prisma.itineraryItem.update({
      where: { id: activityId },
      data: { isCompleted: true },
    });

    // Advance to next activity
    const allProgress = await this.repository.findProgressListBySession(sessionId);
    const nextProgress = allProgress.find(
      (p: ProgressItemRecord) => p.status === 'NOT_STARTED' && p.itineraryActivityId !== activityId,
    );

    const updateData: import('@prisma/client').Prisma.TripSessionUpdateInput = {};
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

    await this.repository.updateSession(sessionId, updateData);
    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(refreshed, refreshed.itinerary, refreshed.activityProgress);
  }

  /**
   * Recovers the active trip session for the authenticated user.
   */
  public async getActiveSession(userId: string): Promise<ActiveTripSessionResponseDto | null> {
    const session = await this.repository.findActiveSessionByUserId(userId);
    if (!session) {
      return null;
    }

    return this.buildResponseDto(session, session.itinerary, session.activityProgress);
  }

  /**
   * Retrieves a specific TripSession by ID.
   */
  public async getSessionById(
    userId: string,
    sessionId: string,
  ): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to view this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.buildResponseDto(session, session.itinerary, session.activityProgress);
  }

  /**
   * Manually finishes an active trip session.
   */
  public async finishTrip(userId: string, sessionId: string): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, 'SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to finish this trip session',
        'FORBIDDEN_RESOURCE',
      );
    }

    const now = new Date();
    // Complete all in-progress activities
    const inProgress = session.activityProgress.filter((p: ProgressItemRecord) => p.status === 'IN_PROGRESS');
    for (const p of inProgress) {
      await this.repository.updateProgress(p.id, {
        status: 'COMPLETED',
        completedAt: now,
      });
    }

    await this.repository.updateSession(sessionId, {
      status: 'COMPLETED',
      endedAt: now,
      currentActivityId: null,
    });

    const refreshed = (await this.repository.findById(sessionId))!;
    return this.buildResponseDto(refreshed, refreshed.itinerary, refreshed.activityProgress);
  }

  /**
   * Cancels an active trip session.
   */
  public async cancelTrip(userId: string, sessionId: string): Promise<StartTripResponseDto> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundError(`TripSession '${sessionId}' not found`, 'SESSION_NOT_FOUND');
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
    return this.buildResponseDto(refreshed, refreshed.itinerary, refreshed.activityProgress);
  }

  /**
   * Reconciles an active TripSession whenever an itinerary is modified.
   * NEVER blocks itinerary edits. Preserves completed progress, updates order,
   * ensures currentActivityId never references a deleted activity, and refreshes route.
   */
  public async reconcileItineraryChange(itineraryId: string): Promise<void> {
    try {
      const activeSession = await this.repository.findActiveSessionByItineraryId(itineraryId);
      if (!activeSession) {
        return; // No active session to reconcile
      }

      const itinerary = await prisma.itinerary.findUnique({
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

      if (!itinerary || itinerary.deletedAt) {
        // Itinerary deleted: finish or cancel active session
        await this.repository.updateSession(activeSession.id, {
          status: 'CANCELLED',
          endedAt: new Date(),
          currentActivityId: null,
        });
        return;
      }

      // Collect updated items in order
      const updatedItems: { id: string; orderIndex: number }[] = [];
      let globalIdx = 0;
      for (const day of itinerary.days) {
        for (const item of day.items) {
          updatedItems.push({ id: item.id, orderIndex: globalIdx++ });
        }
      }

      const updatedItemMap = new Map(updatedItems.map((u) => [u.id, u.orderIndex]));
      const existingProgress = activeSession.activityProgress;
      const existingMap = new Map(existingProgress.map((p: ProgressItemRecord) => [p.itineraryActivityId, p]));

      // 1. Remove progress for activities that were deleted from the itinerary
      for (const prog of existingProgress) {
        if (!updatedItemMap.has(prog.itineraryActivityId)) {
          await this.repository.deleteProgress(activeSession.id, prog.itineraryActivityId);
        }
      }

      // 2. Add progress for newly added activities (default NOT_STARTED)
      for (const item of updatedItems) {
        if (!existingMap.has(item.id)) {
          await this.repository.upsertProgress(activeSession.id, item.id, {
            status: 'NOT_STARTED',
            orderIndex: item.orderIndex,
          });
        }
      }

      // 3. Update orderIndex for remaining progress items
      const orderUpdates: { itineraryActivityId: string; orderIndex: number }[] = [];
      for (const item of updatedItems) {
        orderUpdates.push({
          itineraryActivityId: item.id,
          orderIndex: item.orderIndex,
        });
      }
      if (orderUpdates.length > 0) {
        await this.repository.updateProgressOrders(activeSession.id, orderUpdates);
      }

      // 4. Safe currentActivityId transition
      const refreshedProgress = await this.repository.findProgressListBySession(activeSession.id);
      const isCurrentValid =
        activeSession.currentActivityId !== null &&
        updatedItemMap.has(activeSession.currentActivityId) &&
        refreshedProgress.some(
          (p: ProgressItemRecord) =>
            p.itineraryActivityId === activeSession.currentActivityId && p.status !== 'COMPLETED',
        );

      let newCurrentActivityId = activeSession.currentActivityId;
      let sessionStatus = activeSession.status;
      let endedAt: Date | null = activeSession.endedAt;

      if (!isCurrentValid) {
        // Find first incomplete activity in the updated sequence
        const firstIncomplete = refreshedProgress.find((p: ProgressItemRecord) => p.status !== 'COMPLETED');
        if (firstIncomplete) {
          newCurrentActivityId = firstIncomplete.itineraryActivityId;
          await this.repository.updateProgress(firstIncomplete.id, {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          });
        } else {
          // No incomplete activities left
          newCurrentActivityId = null;
          sessionStatus = 'COMPLETED';
          endedAt = new Date();
        }
      }

      // 5. Recalculate route snapshot
      const coordinates: GeoCoordinate[] = [];
      for (const day of itinerary.days) {
        for (const item of day.items) {
          const c = this.extractItemCoordinate(item);
          if (c) coordinates.push(c);
        }
      }

      const routeCalc = await this.matrixService.calculateRouteLegsAndPolyline(
        coordinates,
        itinerary.transportationMode,
      );

      await this.repository.updateSession(activeSession.id, {
        currentActivityId: newCurrentActivityId,
        status: sessionStatus,
        endedAt,
        routeSnapshot: JSON.stringify(routeCalc),
      });

      logger.info(`Reconciled active trip session ${activeSession.id} for itinerary ${itineraryId}`);
    } catch (err) {
      logger.error({ err }, `Failed to reconcile active trip session for itinerary ${itineraryId}`);
    }
  }
}

export const tripSessionsService = new TripSessionsService();
