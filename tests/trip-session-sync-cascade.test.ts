import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripSessionsService } from '../src/modules/itineraries/trip-sessions.service';
import { ItinerariesService } from '../src/modules/itineraries/itineraries.service';
import { prisma } from '../src/database/prisma';
import { ConflictError, ValidationError } from '../src/common/errors/app-error';

vi.mock('../src/database/prisma', () => ({
  prisma: {
    itinerary: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    tripSession: {
      updateMany: vi.fn(),
    },
  },
}));

describe('Android Synchronization: Status Itinerary & Live Trip Session', () => {
  let tripSessionsService: TripSessionsService;
  let itinerariesService: ItinerariesService;
  let mockTripRepo: any;
  let mockItineraryRepo: any;
  let mockDirectionsService: any;
  let mockSessionService: any;

  const mockUserId = 'user_traveler_100';
  const mockItineraryId = 'itin_100';
  const mockSessionId = 'session_100';

  beforeEach(() => {
    vi.clearAllMocks();

    mockTripRepo = {
      findActiveSessionByUserId: vi.fn(),
      updateSession: vi.fn(),
      createSession: vi.fn(),
      findById: vi.fn(),
    };

    mockDirectionsService = {
      getRoutesForActivities: vi.fn().mockResolvedValue({
        totalDistanceMeters: 1000,
        totalDurationSeconds: 120,
        geometry: 'mock_polyline',
        legs: [],
      }),
    };

    mockItineraryRepo = {
      findById: vi.fn(),
      findActiveTripByUserId: vi.fn(),
      delete: vi.fn(),
      deleteDayAndReindex: vi.fn(),
    };

    mockSessionService = {
      reconcileItineraryChange: vi.fn().mockResolvedValue(undefined),
    };

    tripSessionsService = new TripSessionsService(mockTripRepo, mockDirectionsService, 100);
    itinerariesService = new ItinerariesService(mockItineraryRepo, mockSessionService);
  });

  describe('Item 1: Cascade Cancellation saat Itinerary Dihapus', () => {
    it('should cancel active and in-progress trip sessions when deleteItinerary is called', async () => {
      mockItineraryRepo.findById.mockResolvedValue({
        id: mockItineraryId,
        userId: mockUserId,
      });

      await itinerariesService.deleteItinerary(mockUserId, 'USER', mockItineraryId);

      expect(prisma.tripSession.updateMany).toHaveBeenCalledWith({
        where: {
          itineraryId: mockItineraryId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        data: expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      });

      expect(mockItineraryRepo.delete).toHaveBeenCalledWith(mockItineraryId);
    });

    it('should cancel active and in-progress trip sessions when deleteActiveTrip is called', async () => {
      mockItineraryRepo.findActiveTripByUserId.mockResolvedValue({
        id: mockItineraryId,
        userId: mockUserId,
      });

      const result = await itinerariesService.deleteActiveTrip(mockUserId);

      expect(prisma.tripSession.updateMany).toHaveBeenCalledWith({
        where: {
          itineraryId: mockItineraryId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        data: expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      });

      expect(mockItineraryRepo.delete).toHaveBeenCalledWith(mockItineraryId);
      expect(result).toEqual({ id: mockItineraryId, deleted: true });
    });
  });

  describe('Item 2: Sanitasi Validasi & Auto-Heal pada GET /api/v1/trip-sessions/active', () => {
    it('should auto-cancel orphaned trip session and return null if itinerary is null', async () => {
      mockTripRepo.findActiveSessionByUserId.mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE',
        itinerary: null, // Hard deleted or missing
      });

      const result = await tripSessionsService.getActiveSession(mockUserId);

      expect(mockTripRepo.updateSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      );
      expect(result).toBeNull();
    });

    it('should auto-cancel orphaned trip session and return null if itinerary is soft-deleted', async () => {
      mockTripRepo.findActiveSessionByUserId.mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        itineraryId: mockItineraryId,
        status: 'ACTIVE',
        itinerary: {
          id: mockItineraryId,
          deletedAt: new Date(), // Soft deleted
        },
      });

      const result = await tripSessionsService.getActiveSession(mockUserId);

      expect(mockTripRepo.updateSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
          currentActivityId: null,
        }),
      );
      expect(result).toBeNull();
    });
  });

  describe('Item 3: Standarisasi Response Error saat Start Trip', () => {
    it('should throw EMPTY_ITINERARY ValidationError with Indonesian message when itinerary has no activities', async () => {
      (prisma.itinerary.findFirst as any).mockResolvedValue({
        id: mockItineraryId,
        userId: mockUserId,
        deletedAt: null,
        days: [
          { id: 'day_1', dayNumber: 1, items: [] },
        ],
      });
      mockTripRepo.findActiveSessionByUserId.mockResolvedValue(null);

      try {
        await tripSessionsService.startTrip(mockUserId, mockItineraryId);
        expect.fail('Should have thrown ValidationError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.errorCode).toBe('EMPTY_ITINERARY');
        expect(err.message).toBe('Itinerary tidak memiliki aktivitas atau destinasi untuk dimulai.');
      }
    });

    it('should throw ACTIVE_SESSION_EXISTS ConflictError with activeSessionId and itineraryId in data payload', async () => {
      (prisma.itinerary.findFirst as any).mockResolvedValue({
        id: 'new_itinerary_2',
        userId: mockUserId,
        deletedAt: null,
        days: [
          {
            id: 'day_1',
            dayNumber: 1,
            items: [{ id: 'act_1', isCompleted: false }],
          },
        ],
      });

      const existingActiveSession = {
        id: 'active_session_999',
        userId: mockUserId,
        itineraryId: 'existing_itinerary_111',
        status: 'ACTIVE' as const,
        itinerary: {
          id: 'existing_itinerary_111',
          deletedAt: null,
        },
      };

      mockTripRepo.findActiveSessionByUserId.mockResolvedValue(existingActiveSession);

      try {
        await tripSessionsService.startTrip(mockUserId, 'new_itinerary_2');
        expect.fail('Should have thrown ConflictError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.errorCode).toBe('ACTIVE_SESSION_EXISTS');
        expect(err.message).toBe('Pengguna sudah memiliki perjalanan yang sedang aktif.');
        expect(err.data).toEqual({
          activeSessionId: 'active_session_999',
          itineraryId: 'existing_itinerary_111',
        });
      }
    });
  });
});
