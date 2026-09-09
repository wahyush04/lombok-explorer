import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItinerariesService } from '../src/modules/itineraries/itineraries.service';
import {
  UpdateTripStartDtoSchema,
  AddDayDtoSchema,
  UpdateDayDtoSchema,
} from '../src/modules/itineraries/dto/itinerary.dto';
import { NotFoundError } from '../src/common/errors/app-error';

describe('Active Trip Management Feature Test Suite', () => {
  let service: ItinerariesService;
  let mockRepo: any;
  let mockMatrixService: any;
  let mockOptService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      findActiveTripByUserId: vi.fn(),
      findById: vi.fn(),
      findDayById: vi.fn(),
      findActivityById: vi.fn(),
      updateMasterData: vi.fn(),
      updateDay: vi.fn(),
      deleteDayAndReindex: vi.fn(),
      updateDayTotals: vi.fn(),
      updateItineraryTotals: vi.fn(),
      updateActivity: vi.fn(),
      delete: vi.fn(),
      addDay: vi.fn(),
    };

    mockMatrixService = {
      calculateMatrix: vi.fn().mockResolvedValue({
        distancesKm: [
          [0, 5],
          [5, 0],
        ],
        durationsMinutes: [
          [0, 15],
          [15, 0],
        ],
      }),
    };

    mockOptService = {
      solveOptimization: vi.fn(),
    };

    service = new ItinerariesService(mockRepo, mockMatrixService, mockOptService);
  });

  describe('1. DTO Validation - Start Location and Complete Start Time Setup', () => {
    it('should validate complete start date-time and start location for active trip', () => {
      const validPayload = {
        startLocation: {
          name: 'Bandara Internasional Lombok (BIL)',
          latitude: -8.7588,
          longitude: 116.2764,
          address: 'Tanah Awu, Praya, Kabupaten Lombok Tengah',
        },
        startDate: '2026-09-10T08:30:00.000Z',
        startTime: '08:30',
      };

      const parsed = UpdateTripStartDtoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.startTime).toBe('08:30');
        expect(parsed.data.startLocation?.name).toContain('Bandara');
      }
    });

    it('should validate startTime on Day creation and Day update', () => {
      const validDay = {
        title: 'Hari 1 - Eksplorasi Mandalika',
        startTime: '09:00',
        notes: 'Mulai dari hotel jam 9 pagi',
      };

      const parsedAdd = AddDayDtoSchema.safeParse(validDay);
      expect(parsedAdd.success).toBe(true);
      if (parsedAdd.success) {
        expect(parsedAdd.data.startTime).toBe('09:00');
      }

      const parsedUpdate = UpdateDayDtoSchema.safeParse({ startTime: '07:45' });
      expect(parsedUpdate.success).toBe(true);
      if (parsedUpdate.success) {
        expect(parsedUpdate.data.startTime).toBe('07:45');
      }
    });

    it('should reject invalid startTime format', () => {
      const invalidTime = {
        startTime: '25:99', // Invalid hour and minute
      };
      const result = UpdateDayDtoSchema.safeParse(invalidTime);
      expect(result.success).toBe(false);
    });
  });

  describe('2. Start Time & Activity Duration Cascading / Recalculation', () => {
    it('should schedule activities starting from day.startTime instead of default 08:30', async () => {
      const dayId = 'day_test_1';
      const mockDay = {
        id: dayId,
        itineraryId: 'itin_parent_1',
        dayNumber: 1,
        title: 'Hari 1',
        startTime: '10:00', // Custom start time: 10:00 AM (600 mins from midnight)
        items: [
          {
            id: 'act_1',
            orderIndex: 0,
            estimatedDurationMinutes: 60,
            estimatedCost: 25000,
            destination: {
              name: 'Pantai Kuta',
              latitude: -8.89,
              longitude: 116.28,
            },
          },
          {
            id: 'act_2',
            orderIndex: 1,
            estimatedDurationMinutes: 90,
            estimatedCost: 50000,
            destination: {
              name: 'Tanjung Aan',
              latitude: -8.91,
              longitude: 116.32,
            },
          },
        ],
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.findById.mockResolvedValue({
        id: 'itin_parent_1',
        days: [mockDay],
      });

      await (service as any).recalculateDayRouteAndSchedule(dayId, 'CAR');

      // First activity should start at 10:00 and end at 11:00
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_1',
        expect.objectContaining({
          startTime: '10:00',
          endTime: '11:00',
          timeSlot: '10:00 - 11:00',
        }),
      );

      // Second activity should start after travel duration (15 mins): 11:15 to 12:45
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_2',
        expect.objectContaining({
          startTime: '11:15',
          endTime: '12:45',
          timeSlot: '11:15 - 12:45',
        }),
      );
    });

    it('should cascade schedule when an activity duration is edited', async () => {
      const dayId = 'day_test_2';
      const mockDay = {
        id: dayId,
        itineraryId: 'itin_parent_2',
        dayNumber: 2,
        title: 'Hari 2',
        startTime: '08:30',
        items: [
          {
            id: 'act_1',
            orderIndex: 0,
            estimatedDurationMinutes: 120, // Extended from 60 to 120 mins
            estimatedCost: 20000,
            destination: { latitude: -8.5, longitude: 116.1 },
          },
          {
            id: 'act_2',
            orderIndex: 1,
            estimatedDurationMinutes: 60,
            estimatedCost: 30000,
            destination: { latitude: -8.6, longitude: 116.2 },
          },
        ],
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.findById.mockResolvedValue({
        id: 'itin_parent_2',
        days: [mockDay],
      });

      await (service as any).recalculateDayRouteAndSchedule(dayId, 'CAR');

      // Act 1: 08:30 - 10:30 (120 min)
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_1',
        expect.objectContaining({
          startTime: '08:30',
          endTime: '10:30',
        }),
      );

      // Act 2 starts after 15 min travel: 10:45 - 11:45
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_2',
        expect.objectContaining({
          startTime: '10:45',
          endTime: '11:45',
        }),
      );
    });
  });

  describe('3. Active Trip Start Configuration Setup via Service', () => {
    it('should update active trip start location, start date, and startTime', async () => {
      const userId = 'usr_active_01';
      const activeTrip = {
        id: 'itin_active_99',
        userId,
        title: 'Liburan Tropis Lombok',
        description: 'Trip deskripsi',
        coverImageUrl: null,
        totalDays: 2,
        totalEstimatedBudget: 500000,
        totalDistanceKm: 25,
        totalTravelTimeMinutes: 60,
        travelStyle: 'BEACH_EXPLORER',
        budgetLevel: 'MEDIUM',
        transportationMode: 'CAR',
        startLocation: null,
        endLocation: null,
        pace: 'BALANCED',
        isCustom: true,
        isPublic: false,
        isSaved: true,
        shareToken: null,
        startDate: new Date('2026-09-12T07:30:00.000Z'),
        endDate: null,
        startTime: '07:30',
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [
          {
            id: 'day_1',
            itineraryId: 'itin_active_99',
            dayNumber: 1,
            title: 'Hari 1',
            date: new Date('2026-09-12'),
            startTime: '07:30',
            notes: null,
            totalDistanceKm: 10,
            totalTravelTimeMinutes: 30,
            estimatedBudget: 250000,
            items: [],
          },
          {
            id: 'day_2',
            itineraryId: 'itin_active_99',
            dayNumber: 2,
            title: 'Hari 2',
            date: new Date('2026-09-13'),
            startTime: null,
            notes: null,
            totalDistanceKm: 15,
            totalTravelTimeMinutes: 30,
            estimatedBudget: 250000,
            items: [],
          },
        ],
      };

      mockRepo.findActiveTripByUserId.mockResolvedValue(activeTrip);
      mockRepo.findById.mockResolvedValue(activeTrip);

      const result = await service.updateActiveTripStart(userId, {
        startLocation: {
          name: 'Pelabuhan Bangsal',
          latitude: -8.4061,
          longitude: 116.0967,
          address: 'Pemenang, Lombok Utara',
        },
        startDate: '2026-09-12T07:30:00.000Z',
        startTime: '07:30',
      });

      expect(mockRepo.updateMasterData).toHaveBeenCalledWith(
        'itin_active_99',
        expect.objectContaining({
          startTime: '07:30',
          startDate: expect.any(Date),
        }),
      );

      // Should also update Day 1 start time
      expect(mockRepo.updateDay).toHaveBeenCalledWith('day_1', { startTime: '07:30' });
      expect(result.id).toBe('itin_active_99');
      expect(result.startTime).toBe('07:30');
    });

    it('should throw NotFoundError if user has no active trip to configure start', async () => {
      mockRepo.findActiveTripByUserId.mockResolvedValue(null);

      await expect(
        service.updateActiveTripStart('usr_no_trip', {
          startTime: '08:00',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('4. Delete Active Trip Plan', () => {
    it('should soft delete active trip plan and return confirmation', async () => {
      const userId = 'usr_active_02';
      const activeTrip = {
        id: 'itin_to_delete_1',
        userId,
        title: 'Trip to be deleted',
      };

      mockRepo.findActiveTripByUserId.mockResolvedValue(activeTrip);
      mockRepo.findById.mockResolvedValue(activeTrip);

      const result = await service.deleteActiveTrip(userId);

      expect(mockRepo.delete).toHaveBeenCalledWith('itin_to_delete_1');
      expect(result).toEqual({
        id: 'itin_to_delete_1',
        deleted: true,
      });
    });

    it('should throw NotFoundError when attempting to delete active trip if none exists', async () => {
      mockRepo.findActiveTripByUserId.mockResolvedValue(null);

      await expect(service.deleteActiveTrip('usr_no_trip')).rejects.toThrow(NotFoundError);
    });
  });

  describe('5. Auto-Delete Trip Plan on Deleting the Last Remaining Day', () => {
    it('should delete active trip plan when the user deletes the last day of the trip', async () => {
      const userId = 'usr_active_03';
      const itineraryId = 'itin_single_day';
      const dayId = 'day_only_one';

      const mockDay = {
        id: dayId,
        itineraryId,
        dayNumber: 1,
        itinerary: {
          id: itineraryId,
          userId,
        },
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      // Simulating repository detecting 0 remaining days and soft-deleting itinerary
      mockRepo.deleteDayAndReindex.mockResolvedValue({
        remainingDaysCount: 0,
        itineraryDeleted: true,
      });

      const result = await service.deleteDay(userId, 'USER', itineraryId, dayId);

      expect(mockRepo.deleteDayAndReindex).toHaveBeenCalledWith(itineraryId, dayId);
      expect(result).toEqual({
        deletedTrip: true,
        tripId: itineraryId,
        message: expect.stringContaining('Trip plan aktif telah dihapus'),
      });
    });

    it('should delete active trip plan even when referenced via "active" keyword', async () => {
      const userId = 'usr_active_04';
      const resolvedTripId = 'itin_active_keyword';
      const dayId = 'day_last';

      mockRepo.findActiveTripByUserId.mockResolvedValue({
        id: resolvedTripId,
        userId,
      });

      const mockDay = {
        id: dayId,
        itineraryId: resolvedTripId,
        itinerary: {
          id: resolvedTripId,
          userId,
        },
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.deleteDayAndReindex.mockResolvedValue({
        remainingDaysCount: 0,
        itineraryDeleted: true,
      });

      const result = await service.deleteDay(userId, 'USER', 'active', dayId);

      expect(mockRepo.deleteDayAndReindex).toHaveBeenCalledWith(resolvedTripId, dayId);
      expect(result).toEqual({
        deletedTrip: true,
        tripId: resolvedTripId,
        message: expect.stringContaining('Trip plan aktif telah dihapus'),
      });
    });
  });
});
