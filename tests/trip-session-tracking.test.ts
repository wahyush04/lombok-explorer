import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripSessionsService } from '../src/modules/itineraries/trip-sessions.service';
import { prisma } from '../src/database/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/common/errors/app-error';

vi.mock('../src/database/prisma', () => ({
  prisma: {
    itinerary: {
      findUnique: vi.fn(),
    },
    itineraryItem: {
      update: vi.fn(),
    },
  },
}));

describe('Live Trip Tracking & Start Trip Feature Test Suite', () => {
  let service: TripSessionsService;
  let mockRepo: any;
  let mockDirectionsService: any;

  const mockUserId = 'user_traveler_1';
  const mockOtherUserId = 'user_traveler_2';
  const mockItineraryId = 'itin_lombok_south_1';
  const mockOtherItineraryId = 'itin_lombok_north_2';

  const createMockItinerary = (override?: any) => ({
    id: mockItineraryId,
    userId: mockUserId,
    title: 'Pesona Lombok Selatan',
    transportationMode: 'CAR' as const,
    totalDays: 2,
    totalDistanceKm: 45.5,
    totalTravelTimeMinutes: 120,
    deletedAt: null,
    days: [
      {
        id: 'day_1',
        dayNumber: 1,
        items: [
          {
            id: 'act_1',
            orderIndex: 0,
            itemType: 'DESTINATION' as const,
            destinationId: 'dest_1',
            isCompleted: false,
            estimatedDurationMinutes: 60,
            activityNotes: 'Melihat pantai pasir merica',
            destination: {
              id: 'dest_1',
              name: 'Pantai Tanjung Aan',
              latitude: -8.9082,
              longitude: 116.3195,
              address: 'Pujut, Lombok Tengah',
              locationName: 'Tanjung Aan',
            },
          },
          {
            id: 'act_2',
            orderIndex: 1,
            itemType: 'DESTINATION' as const,
            destinationId: 'dest_2',
            isCompleted: false,
            estimatedDurationMinutes: 90,
            activityNotes: 'Sunset view di bukit',
            destination: {
              id: 'dest_2',
              name: 'Bukit Merese',
              latitude: -8.9135,
              longitude: 116.3268,
              address: 'Pujut, Lombok Tengah',
              locationName: 'Merese',
            },
          },
        ],
      },
      {
        id: 'day_2',
        dayNumber: 2,
        items: [
          {
            id: 'act_3',
            orderIndex: 0,
            itemType: 'DESTINATION' as const,
            destinationId: 'dest_3',
            isCompleted: false,
            estimatedDurationMinutes: 120,
            activityNotes: 'Belajar selancar',
            destination: {
              id: 'dest_3',
              name: 'Pantai Selong Belanak',
              latitude: -8.8681,
              longitude: 116.1627,
              address: 'Praya Barat, Lombok Tengah',
              locationName: 'Selong Belanak',
            },
          },
        ],
      },
    ],
    ...override,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      createSession: vi.fn(),
      findActiveSessionByUserId: vi.fn(),
      findActiveSessionByItineraryId: vi.fn(),
      findById: vi.fn(),
      updateSession: vi.fn(),
      findProgressBySessionAndActivity: vi.fn(),
      updateProgress: vi.fn(),
      upsertProgress: vi.fn(),
      createProgress: vi.fn(),
      deleteProgress: vi.fn(),
      findProgressListBySession: vi.fn(),
      updateProgressOrders: vi.fn(),
      replaceRoutes: vi.fn(),
      findRoutesBySessionId: vi.fn().mockResolvedValue([]),
    };

    mockDirectionsService = {
      getRoutesForActivities: vi.fn().mockResolvedValue({
        totalDistanceMeters: 45500,
        totalDurationSeconds: 7200,
        geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        legs: [
          {
            fromActivityId: 'act_1',
            toActivityId: 'act_2',
            legOrder: 0,
            distanceMeters: 2500,
            durationSeconds: 600,
            geometry: '_p~iF~ps|U',
          },
          {
            fromActivityId: 'act_2',
            toActivityId: 'act_3',
            legOrder: 1,
            distanceMeters: 43000,
            durationSeconds: 6600,
            geometry: '_ulLnnqC_mqNvxq`@',
          },
        ],
      }),
      getRoute: vi.fn().mockResolvedValue({
        distanceMeters: 2500,
        durationSeconds: 600,
        geometry: '_p~iF~ps|U',
      }),
      getRouteForLeg: vi.fn().mockResolvedValue({
        fromActivityId: 'act_1',
        toActivityId: 'act_2',
        legOrder: 0,
        distanceMeters: 2500,
        durationSeconds: 600,
        geometry: '_p~iF~ps|U',
      }),
    };

    service = new TripSessionsService(mockRepo, mockDirectionsService, 100);
  });

  describe('1. Start Trip & Session Initialization', () => {
    it('should start trip successfully, initialize progress, and set first activity as IN_PROGRESS', async () => {
      const mockItinerary = createMockItinerary();
      (prisma.itinerary.findUnique as any).mockResolvedValue(mockItinerary);
      mockRepo.findActiveSessionByUserId.mockResolvedValue(null);

      const createdSessionData = {
        id: 'session_1',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: JSON.stringify({
          totalDistanceKm: 45.5,
          totalDurationMinutes: 120,
          polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
          legs: [],
        }),
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        routes: [
          {
            id: 'route_1',
            tripSessionId: 'session_1',
            fromActivityId: 'act_1',
            toActivityId: 'act_2',
            legOrder: 0,
            distanceMeters: 2500,
            durationSeconds: 600,
            geometry: '_p~iF~ps|U',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'IN_PROGRESS' as const,
            orderIndex: 0,
            startedAt: new Date(),
            completedAt: null,
            arrivalDetectedAt: null,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'NOT_STARTED' as const,
            orderIndex: 1,
            startedAt: null,
            completedAt: null,
            arrivalDetectedAt: null,
          },
          {
            id: 'prog_3',
            itineraryActivityId: 'act_3',
            status: 'NOT_STARTED' as const,
            orderIndex: 2,
            startedAt: null,
            completedAt: null,
            arrivalDetectedAt: null,
          },
        ],
      };

      mockRepo.createSession.mockResolvedValue(createdSessionData);

      const result = await service.startTrip(mockUserId, mockItineraryId);

      expect(mockRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          itineraryId: mockItineraryId,
          status: 'ACTIVE',
          currentActivityId: 'act_1',
        }),
        expect.arrayContaining([
          expect.objectContaining({ itineraryActivityId: 'act_1', status: 'IN_PROGRESS' }),
          expect.objectContaining({ itineraryActivityId: 'act_2', status: 'NOT_STARTED' }),
          expect.objectContaining({ itineraryActivityId: 'act_3', status: 'NOT_STARTED' }),
        ]),
        expect.any(Array),
      );

      expect(result.session.id).toBe('session_1');
      expect(result.session.currentActivityId).toBe('act_1');
      expect(result.currentActivity?.id).toBe('act_1');
      expect(result.currentActivity?.arrivalRadiusMeters).toBe(100);
      expect(result.activities).toHaveLength(3);
      expect(result.route.totalDistanceKm).toBe(45.5);
      expect(result.route.polyline).toBeDefined();
    });

    it('should be idempotent when user duplicates Start Trip for the SAME itinerary', async () => {
      const mockItinerary = createMockItinerary();
      (prisma.itinerary.findUnique as any).mockResolvedValue(mockItinerary);

      const existingActiveSession = {
        id: 'session_existing_active',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'IN_PROGRESS' as const,
            orderIndex: 0,
            startedAt: new Date(),
            completedAt: null,
            arrivalDetectedAt: null,
          },
        ],
      };

      mockRepo.findActiveSessionByUserId.mockResolvedValue(existingActiveSession);

      const result = await service.startTrip(mockUserId, mockItineraryId);

      // Should not create new session, returns existing
      expect(mockRepo.createSession).not.toHaveBeenCalled();
      expect(result.session.id).toBe('session_existing_active');
      expect(result.session.itineraryId).toBe(mockItineraryId);
    });

    it('should reject Start Trip if user already has an active session on a DIFFERENT itinerary', async () => {
      const mockItinerary = createMockItinerary();
      (prisma.itinerary.findUnique as any).mockResolvedValue(mockItinerary);

      const existingActiveSession = {
        id: 'session_other',
        userId: mockUserId,
        itineraryId: mockOtherItineraryId, // Different itinerary!
        status: 'ACTIVE' as const,
      };

      mockRepo.findActiveSessionByUserId.mockResolvedValue(existingActiveSession);

      await expect(service.startTrip(mockUserId, mockItineraryId)).rejects.toThrow(ConflictError);
    });

    it('should reject Start Trip if user does not own the itinerary', async () => {
      const mockItinerary = createMockItinerary({ userId: mockOtherUserId });
      (prisma.itinerary.findUnique as any).mockResolvedValue(mockItinerary);

      await expect(service.startTrip(mockUserId, mockItineraryId)).rejects.toThrow(ForbiddenError);
    });

    it('should reject Start Trip if itinerary has no activities', async () => {
      const mockItinerary = createMockItinerary({ days: [{ id: 'day_empty', dayNumber: 1, items: [] }] });
      (prisma.itinerary.findUnique as any).mockResolvedValue(mockItinerary);
      mockRepo.findActiveSessionByUserId.mockResolvedValue(null);

      await expect(service.startTrip(mockUserId, mockItineraryId)).rejects.toThrow(ValidationError);
    });
  });

  describe('2. Active Trip Recovery', () => {
    it('should recover active trip session with full restoration data for Android', async () => {
      const mockItinerary = createMockItinerary();
      const existingSession = {
        id: 'session_active_recovery',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_2',
        routeSnapshot: JSON.stringify({
          totalDistanceKm: 45.5,
          totalDurationMinutes: 120,
          polyline: '_p~iF~ps|U',
          legs: [],
        }),
        lastLatitude: -8.9082,
        lastLongitude: 116.3195,
        lastAccuracy: 10,
        lastLocationAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const,
            orderIndex: 0,
            startedAt: new Date(),
            completedAt: new Date(),
            arrivalDetectedAt: new Date(),
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'IN_PROGRESS' as const,
            orderIndex: 1,
            startedAt: new Date(),
            completedAt: null,
            arrivalDetectedAt: null,
          },
          {
            id: 'prog_3',
            itineraryActivityId: 'act_3',
            status: 'NOT_STARTED' as const,
            orderIndex: 2,
            startedAt: null,
            completedAt: null,
            arrivalDetectedAt: null,
          },
        ],
      };

      mockRepo.findActiveSessionByUserId.mockResolvedValue(existingSession);

      const result = await service.getActiveSession(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.session.id).toBe('session_active_recovery');
      expect(result?.currentActivity?.id).toBe('act_2');
      expect(result?.currentActivity?.status).toBe('IN_PROGRESS');
      expect(result?.activities[0]?.status).toBe('COMPLETED');
      expect(result?.nextActivities).toHaveLength(1);
      expect(result?.nextActivities[0]?.id).toBe('act_3');
      expect(result?.progressPercentage).toBe(33); // 1 of 3 completed
    });

    it('should return null when user has no active trip session', async () => {
      mockRepo.findActiveSessionByUserId.mockResolvedValue(null);
      const result = await service.getActiveSession('user_without_session');
      expect(result).toBeNull();
    });
  });

  describe('3. Location Sync & Arrival Detection', () => {
    it('should validate proximity and mark activity COMPLETED when arrival is detected within radius', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_track_1',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'IN_PROGRESS' as const,
            orderIndex: 0,
            startedAt: new Date(),
            completedAt: null,
            arrivalDetectedAt: null,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'NOT_STARTED' as const,
            orderIndex: 1,
            startedAt: null,
            completedAt: null,
            arrivalDetectedAt: null,
          },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[0]);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.syncLocation(mockUserId, 'session_track_1', {
        latitude: -8.9083,
        longitude: 116.3196,
        accuracy: 10,
        arrivalDetected: true,
      });

      // 1. Progress 1 marked COMPLETED
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_1',
        expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          arrivalDetectedAt: expect.any(Date),
        }),
      );

      // 2. Next activity advanced to IN_PROGRESS
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_2',
        expect.objectContaining({
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        }),
      );

      // 3. Session updated with new currentActivityId
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_track_1',
        expect.objectContaining({
          currentActivityId: 'act_2',
          lastLatitude: -8.9083,
          lastLongitude: 116.3196,
        }),
      );
    });

    it('should reject arrivalDetected if user location is far outside arrival radius', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_track_2',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'IN_PROGRESS' as const,
            orderIndex: 0,
          },
        ],
        routes: [],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[0]);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await expect(
        service.syncLocation(mockUserId, 'session_track_2', {
          latitude: -8.5,
          longitude: 116.0,
          arrivalDetected: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should safely and idempotently handle duplicate completion (offline retry safe)', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_track_3',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_2',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const, // Already completed!
            orderIndex: 0,
          },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[0]);

      // Requesting arrival on already completed activity
      const result = await service.syncLocation(mockUserId, 'session_track_3', {
        activityId: 'act_1',
        latitude: -8.9082,
        longitude: 116.3195,
        arrivalDetected: true,
      });

      // Does not re-complete or throw error, returns valid state
      expect(result.activities[0]?.status).toBe('COMPLETED');
    });

    it('should transition TripSession to COMPLETED when the final activity is completed', async () => {
      const mockItinerary = createMockItinerary();
      const singleItemSession = {
        id: 'session_final',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_3',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: mockItinerary,
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const,
            orderIndex: 0,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'COMPLETED' as const,
            orderIndex: 1,
          },
          {
            id: 'prog_3',
            itineraryActivityId: 'act_3', // Final activity!
            status: 'IN_PROGRESS' as const,
            orderIndex: 2,
          },
        ],
      };

      mockRepo.findById.mockResolvedValue(singleItemSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(singleItemSession.activityProgress[2]);
      mockRepo.findProgressListBySession.mockResolvedValue(singleItemSession.activityProgress);

      await service.syncLocation(mockUserId, 'session_final', {
        activityId: 'act_3',
        latitude: -8.8681,
        longitude: 116.1627,
        arrivalDetected: true,
      });

      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_final',
        expect.objectContaining({
          status: 'COMPLETED',
          currentActivityId: null,
          endedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('4. Active Itinerary Reconciliation (START TRIP != LOCK ITINERARY)', () => {
    it('should preserve completed progress when a new activity is added during active trip', async () => {
      const activeSession = {
        id: 'session_reconcile_add',
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2',
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const, // Preserved!
            orderIndex: 0,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'IN_PROGRESS' as const,
            orderIndex: 1,
          },
        ],
      };

      mockRepo.findActiveSessionByItineraryId.mockResolvedValue(activeSession);

      // User added act_new to the itinerary
      const updatedItinerary = {
        id: mockItineraryId,
        transportationMode: 'CAR' as const,
        days: [
          {
            id: 'day_1',
            dayNumber: 1,
            items: [
              { id: 'act_1', orderIndex: 0, destination: { latitude: -8.9, longitude: 116.3 } },
              { id: 'act_2', orderIndex: 1, destination: { latitude: -8.91, longitude: 116.32 } },
              { id: 'act_new', orderIndex: 2, destination: { latitude: -8.92, longitude: 116.33 } },
            ],
          },
        ],
      };

      (prisma.itinerary.findUnique as any).mockResolvedValue(updatedItinerary);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.reconcileItineraryChange(mockItineraryId);

      // act_new should be added as NOT_STARTED
      expect(mockRepo.upsertProgress).toHaveBeenCalledWith(
        'session_reconcile_add',
        'act_new',
        expect.objectContaining({
          status: 'NOT_STARTED',
          orderIndex: 2,
        }),
      );

      // Route snapshot recalculated and directions called
      expect(mockDirectionsService.getRoutesForActivities).toHaveBeenCalled();
      expect(mockRepo.replaceRoutes).toHaveBeenCalledWith(
        'session_reconcile_add',
        expect.any(Array),
      );
    });

    it('should safely transition currentActivityId when the CURRENT activity is deleted', async () => {
      const activeSession = {
        id: 'session_reconcile_del_current',
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2', // This activity will be deleted!
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const,
            orderIndex: 0,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'IN_PROGRESS' as const,
            orderIndex: 1,
          },
          {
            id: 'prog_3',
            itineraryActivityId: 'act_3',
            status: 'NOT_STARTED' as const,
            orderIndex: 2,
          },
        ],
      };

      mockRepo.findActiveSessionByItineraryId.mockResolvedValue(activeSession);

      // User deleted act_2 from the itinerary!
      const updatedItinerary = {
        id: mockItineraryId,
        transportationMode: 'CAR' as const,
        days: [
          {
            id: 'day_1',
            dayNumber: 1,
            items: [
              { id: 'act_1', orderIndex: 0, destination: { latitude: -8.9, longitude: 116.3 } },
              { id: 'act_3', orderIndex: 1, destination: { latitude: -8.86, longitude: 116.16 } },
            ],
          },
        ],
      };

      (prisma.itinerary.findUnique as any).mockResolvedValue(updatedItinerary);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.reconcileItineraryChange(mockItineraryId);

      // 1. Deleted activity progress deleted
      expect(mockRepo.deleteProgress).toHaveBeenCalledWith('session_reconcile_del_current', 'act_2');

      // 2. act_3 advanced to IN_PROGRESS
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_3',
        expect.objectContaining({
          status: 'IN_PROGRESS',
        }),
      );

      // 3. currentActivityId safely points to act_3, NEVER orphaned act_2
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_reconcile_del_current',
        expect.objectContaining({
          currentActivityId: 'act_3',
        }),
      );
    });

    it('should update remaining execution order and preserve completed items when reordered', async () => {
      const activeSession = {
        id: 'session_reconcile_reorder',
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2',
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'COMPLETED' as const,
            orderIndex: 0,
          },
          {
            id: 'prog_2',
            itineraryActivityId: 'act_2',
            status: 'IN_PROGRESS' as const,
            orderIndex: 1,
          },
          {
            id: 'prog_3',
            itineraryActivityId: 'act_3',
            status: 'NOT_STARTED' as const,
            orderIndex: 2,
          },
        ],
      };

      mockRepo.findActiveSessionByItineraryId.mockResolvedValue(activeSession);

      // User swapped act_2 and act_3 order in itinerary
      const updatedItinerary = {
        id: mockItineraryId,
        transportationMode: 'CAR' as const,
        days: [
          {
            id: 'day_1',
            dayNumber: 1,
            items: [
              { id: 'act_1', orderIndex: 0, destination: { latitude: -8.9, longitude: 116.3 } },
              { id: 'act_3', orderIndex: 1, destination: { latitude: -8.86, longitude: 116.16 } },
              { id: 'act_2', orderIndex: 2, destination: { latitude: -8.91, longitude: 116.32 } },
            ],
          },
        ],
      };

      (prisma.itinerary.findUnique as any).mockResolvedValue(updatedItinerary);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.reconcileItineraryChange(mockItineraryId);

      // Updates progress orders according to new sequence
      expect(mockRepo.updateProgressOrders).toHaveBeenCalledWith(
        'session_reconcile_reorder',
        expect.arrayContaining([
          { itineraryActivityId: 'act_1', orderIndex: 0 },
          { itineraryActivityId: 'act_3', orderIndex: 1 },
          { itineraryActivityId: 'act_2', orderIndex: 2 },
        ]),
      );
      // Recalculates route snapshot
      expect(mockDirectionsService.getRoutesForActivities).toHaveBeenCalled();
    });
  });

  describe('5. Finish & Cancel Trip Operations', () => {
    it('should finish trip manually and mark status COMPLETED', async () => {
      const activeSession = {
        id: 'session_finish_1',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: createMockItinerary(),
        activityProgress: [
          {
            id: 'prog_1',
            itineraryActivityId: 'act_1',
            status: 'IN_PROGRESS' as const,
          },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);

      await service.finishTrip(mockUserId, 'session_finish_1');

      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_finish_1',
        expect.objectContaining({
          status: 'COMPLETED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      );
    });

    it('should cancel trip session and mark status CANCELLED', async () => {
      const activeSession = {
        id: 'session_cancel_1',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        startedAt: new Date(),
        endedAt: null,
        pausedAt: null,
        currentActivityId: 'act_1',
        routeSnapshot: null,
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracy: null,
        lastLocationAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        itinerary: createMockItinerary(),
        activityProgress: [],
      };

      mockRepo.findById.mockResolvedValue(activeSession);

      await service.cancelTrip(mockUserId, 'session_cancel_1');

      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_cancel_1',
        expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      );
    });
  });

  describe('6. Authorization Security', () => {
    it('should prevent unauthorized users from syncing another user trip session', async () => {
      const otherUserSession = {
        id: 'session_sec_1',
        userId: mockOtherUserId, // Belonging to mockOtherUserId
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
      };

      mockRepo.findById.mockResolvedValue(otherUserSession);

      await expect(
        service.syncLocation(mockUserId, 'session_sec_1', {
          latitude: -8.9,
          longitude: 116.3,
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should prevent unauthorized users from finishing another user trip session', async () => {
      const otherUserSession = {
        id: 'session_sec_2',
        userId: mockOtherUserId,
        status: 'ACTIVE' as const,
      };

      mockRepo.findById.mockResolvedValue(otherUserSession);

      await expect(service.finishTrip(mockUserId, 'session_sec_2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('7. Start & Skip Activity Operations (State Machine & Idempotency)', () => {
    it('should start activity transitioning NOT_STARTED -> IN_PROGRESS and update currentActivityId', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_start_act',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_1',
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          { id: 'prog_1', itineraryActivityId: 'act_1', status: 'COMPLETED' as const, orderIndex: 0 },
          { id: 'prog_2', itineraryActivityId: 'act_2', status: 'NOT_STARTED' as const, orderIndex: 1 },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[1]);

      const result = await service.startActivity(mockUserId, 'session_start_act', 'act_2', {
        latitude: -8.9135,
        longitude: 116.3268,
      });

      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_2',
        expect.objectContaining({
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        }),
      );
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_start_act',
        expect.objectContaining({
          currentActivityId: 'act_2',
        }),
      );
      expect(result.session.id).toBe('session_start_act');
    });

    it('should be idempotent when startActivity is called on an activity already IN_PROGRESS', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_start_idem',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2',
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          { id: 'prog_2', itineraryActivityId: 'act_2', status: 'IN_PROGRESS' as const, orderIndex: 0 },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[0]);

      await service.startActivity(mockUserId, 'session_start_idem', 'act_2');

      // Does not update progress again
      expect(mockRepo.updateProgress).not.toHaveBeenCalled();
    });

    it('should reject startActivity if activity is already COMPLETED or SKIPPED', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_start_rej',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2',
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          { id: 'prog_1', itineraryActivityId: 'act_1', status: 'COMPLETED' as const, orderIndex: 0 },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[0]);

      await expect(
        service.startActivity(mockUserId, 'session_start_rej', 'act_1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should skip activity and advance currentActivityId to the next NOT_STARTED activity', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_skip_act',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_2',
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          { id: 'prog_1', itineraryActivityId: 'act_1', status: 'COMPLETED' as const, orderIndex: 0 },
          { id: 'prog_2', itineraryActivityId: 'act_2', status: 'IN_PROGRESS' as const, orderIndex: 1 },
          { id: 'prog_3', itineraryActivityId: 'act_3', status: 'NOT_STARTED' as const, orderIndex: 2 },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[1]);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.skipActivity(mockUserId, 'session_skip_act', 'act_2', {
        reason: 'Cuaca buruk',
      });

      // 1. prog_2 marked SKIPPED
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_2',
        expect.objectContaining({
          status: 'SKIPPED',
          skippedAt: expect.any(Date),
        }),
      );

      // 2. prog_3 advanced to IN_PROGRESS
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(
        'prog_3',
        expect.objectContaining({
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        }),
      );

      // 3. session updated with act_3 as currentActivityId
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_skip_act',
        expect.objectContaining({
          currentActivityId: 'act_3',
        }),
      );
    });

    it('should finish trip session when the last remaining activity is skipped', async () => {
      const mockItinerary = createMockItinerary();
      const activeSession = {
        id: 'session_skip_last',
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE' as const,
        currentActivityId: 'act_3',
        itinerary: mockItinerary,
        routes: [],
        activityProgress: [
          { id: 'prog_1', itineraryActivityId: 'act_1', status: 'COMPLETED' as const, orderIndex: 0 },
          { id: 'prog_2', itineraryActivityId: 'act_2', status: 'COMPLETED' as const, orderIndex: 1 },
          { id: 'prog_3', itineraryActivityId: 'act_3', status: 'IN_PROGRESS' as const, orderIndex: 2 },
        ],
      };

      mockRepo.findById.mockResolvedValue(activeSession);
      mockRepo.findProgressBySessionAndActivity.mockResolvedValue(activeSession.activityProgress[2]);
      mockRepo.findProgressListBySession.mockResolvedValue(activeSession.activityProgress);

      await service.skipActivity(mockUserId, 'session_skip_last', 'act_3');

      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        'session_skip_last',
        expect.objectContaining({
          status: 'COMPLETED',
          currentActivityId: null,
          endedAt: expect.any(Date),
        }),
      );
    });
  });
});
