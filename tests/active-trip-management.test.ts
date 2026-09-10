import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItinerariesService } from '../src/modules/itineraries/itineraries.service';
import {
  UpdateTripStartDtoSchema,
  AddDayDtoSchema,
  UpdateDayDtoSchema,
  UpdateDayStartDtoSchema,
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
      findDayByNumber: vi.fn(),
      findDestinationById: vi.fn(),
      findAccommodationById: vi.fn(),
      findRestaurantById: vi.fn(),
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

  describe('6. Distance and Travel Time between Start Location and First Activity', () => {
    it('should calculate distance and transit time from startLocation to first activity on Day 1', async () => {
      const dayId = 'day_with_start_loc';
      const mockDay = {
        id: dayId,
        itineraryId: 'itin_with_start',
        dayNumber: 1,
        title: 'Hari 1',
        startTime: '08:30',
        itinerary: {
          id: 'itin_with_start',
          startLocation: JSON.stringify({
            name: 'Jeeva Beloam Beach Camp',
            latitude: -8.9056,
            longitude: 116.5132,
            address: 'Jerowaru, Lombok Timur',
          }),
        },
        items: [
          {
            id: 'act_gili_trawangan',
            orderIndex: 0,
            estimatedDurationMinutes: 240,
            estimatedCost: 50000,
            destination: {
              name: 'Gili Trawangan',
              latitude: -8.35,
              longitude: 116.03,
            },
          },
          {
            id: 'act_shark_point',
            orderIndex: 1,
            estimatedDurationMinutes: 180,
            estimatedCost: 150000,
            destination: {
              name: 'Shark Point Gili',
              latitude: -8.34,
              longitude: 116.02,
            },
          },
        ],
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.findById.mockResolvedValue({
        id: 'itin_with_start',
        days: [mockDay],
      });

      // Mock matrix result: [startLocation, act_gili_trawangan, act_shark_point]
      // index 0 -> index 1: 90 km, 120 mins
      // index 1 -> index 2: 2.81 km, 13 mins
      mockMatrixService.calculateMatrix.mockResolvedValue({
        distancesKm: [
          [0, 90, 92],
          [90, 0, 2.81],
          [92, 2.81, 0],
        ],
        durationsMinutes: [
          [0, 120, 130],
          [120, 0, 13],
          [130, 13, 0],
        ],
      });

      await (service as any).recalculateDayRouteAndSchedule(dayId, 'CAR');

      // First activity (Gili Trawangan) should receive distance and duration from startLocation
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_gili_trawangan',
        expect.objectContaining({
          distanceFromPrevKm: 90,
          travelTimeFromPrevMinutes: 120,
          startTime: '10:30', // 08:30 + 120 mins transit
          endTime: '14:30',   // 10:30 + 240 mins visit
          timeSlot: '10:30 - 14:30',
        }),
      );

      // Second activity (Shark Point) should receive distance and duration from Gili Trawangan
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_shark_point',
        expect.objectContaining({
          distanceFromPrevKm: 2.81,
          travelTimeFromPrevMinutes: 13,
          startTime: '14:43', // 14:30 + 13 mins transit
          endTime: '17:43',   // 14:43 + 180 mins visit
          timeSlot: '14:43 - 17:43',
        }),
      );

      // Day totals should include startLocation distance (90 + 2.81 = 92.81 km)
      expect(mockRepo.updateDayTotals).toHaveBeenCalledWith(
        dayId,
        expect.objectContaining({
          totalDistanceKm: 92.81,
          totalTravelTimeMinutes: 133,
        }),
      );
    });

    it('should keep first activity distance as 0 when startLocation is null/undefined (backward compatibility)', async () => {
      const dayId = 'day_without_start_loc';
      const mockDay = {
        id: dayId,
        itineraryId: 'itin_no_start',
        dayNumber: 1,
        title: 'Hari 1',
        startTime: '08:30',
        itinerary: {
          id: 'itin_no_start',
          startLocation: null,
        },
        items: [
          {
            id: 'act_1',
            orderIndex: 0,
            estimatedDurationMinutes: 60,
            estimatedCost: 10000,
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
            estimatedCost: 20000,
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
        id: 'itin_no_start',
        days: [mockDay],
      });

      mockMatrixService.calculateMatrix.mockResolvedValue({
        distancesKm: [
          [0, 5],
          [5, 0],
        ],
        durationsMinutes: [
          [0, 15],
          [15, 0],
        ],
      });

      await (service as any).recalculateDayRouteAndSchedule(dayId, 'CAR');

      // Without startLocation, first activity starts at day.startTime with 0 distance
      expect(mockRepo.updateActivity).toHaveBeenCalledWith(
        'act_1',
        expect.objectContaining({
          distanceFromPrevKm: 0,
          travelTimeFromPrevMinutes: 0,
          startTime: '08:30',
          endTime: '09:30',
        }),
      );
    });

    it('should map startLocation, distanceFromStartKm, and travelTimeFromStartMinutes in mapToDto', () => {
      const mockItineraryWithRelations: any = {
        id: 'itin_dto_test',
        userId: 'usr_1',
        title: '3 Hari Liburan Gili',
        description: null,
        coverImageUrl: null,
        totalDays: 1,
        totalEstimatedBudget: 500000,
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        transportationMode: 'CAR',
        pace: 'BALANCED',
        isCustom: false,
        isPublic: false,
        isSaved: true,
        shareToken: null,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-12'),
        startTime: '08:30',
        startLocation: JSON.stringify({
          name: 'Jeeva Beloam Beach Camp',
          latitude: -8.9056,
          longitude: 116.5132,
          address: 'Jerowaru, Lombok Timur',
        }),
        endLocation: null,
        totalDistanceKm: 92.81,
        totalTravelTimeMinutes: 133,
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [
          {
            id: 'day_1',
            itineraryId: 'itin_dto_test',
            dayNumber: 1,
            title: 'Hari 1: Eksplorasi Gili Trawangan',
            date: new Date('2026-09-10'),
            startTime: '08:30',
            notes: null,
            totalDistanceKm: 92.81,
            totalTravelTimeMinutes: 133,
            estimatedBudget: 200000,
            items: [
              {
                id: 'act_1',
                itineraryDayId: 'day_1',
                orderIndex: 0,
                itemType: 'DESTINATION',
                destinationId: 'dest_1',
                destination: {
                  id: 'dest_1',
                  name: 'Gili Trawangan',
                  latitude: -8.35,
                  longitude: 116.03,
                },
                startTime: '10:30',
                endTime: '14:30',
                timeSlot: '10:30 - 14:30',
                estimatedDurationMinutes: 240,
                estimatedCost: 50000,
                distanceFromPrevKm: 90,
                travelTimeFromPrevMinutes: 120,
                isCompleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
        ],
      };

      const dto = (service as any).mapToDto(mockItineraryWithRelations);

      // Verify Day 1 properties
      expect(dto.days[0].startLocation?.name).toBe('Jeeva Beloam Beach Camp');
      expect(dto.days[0].distanceFromStartKm).toBe(90);
      expect(dto.days[0].travelTimeFromStartMinutes).toBe(120);

      // Verify Activity 1 properties
      expect(dto.days[0].activities[0].distanceFromPrevKm).toBe(90);
      expect(dto.days[0].activities[0].travelDurationMinutes).toBe(120);
      expect(dto.days[0].activities[0].distanceFromStartKm).toBe(90);
      expect(dto.days[0].activities[0].travelTimeFromStartMinutes).toBe(120);
    });
  });

  describe('5. Multi-Day Automatic Start Location Chaining & User Custom Override', () => {
    it('should validate UpdateDayStartDtoSchema with custom coordinates', () => {
      const validCustom = {
        startLocation: {
          name: 'Hotel Senggigi Beach',
          latitude: -8.4983,
          longitude: 116.0504,
          address: 'Jl. Raya Senggigi KM 8',
        },
        startTime: '08:00',
      };
      const parsed = UpdateDayStartDtoSchema.safeParse(validCustom);
      expect(parsed.success).toBe(true);
    });

    it('should validate UpdateDayStartDtoSchema with catalog ID references', () => {
      const validAccom = {
        startLocation: {
          accommodationId: 'accom_123',
        },
      };
      const parsedAccom = UpdateDayStartDtoSchema.safeParse(validAccom);
      expect(parsedAccom.success).toBe(true);

      const validDest = {
        startLocation: {
          destinationId: 'dest_456',
        },
      };
      const parsedDest = UpdateDayStartDtoSchema.safeParse(validDest);
      expect(parsedDest.success).toBe(true);

      // Reset to automatic chaining with null
      const validNull = {
        startLocation: null,
      };
      const parsedNull = UpdateDayStartDtoSchema.safeParse(validNull);
      expect(parsedNull.success).toBe(true);
    });

    it('should automatically chain Day 2 start location from Day 1 last activity in mapToDto', () => {
      const multiDayItinerary = {
        id: 'itin_multi_day',
        userId: 'user_1',
        title: '2 Hari Trip Lombok',
        description: null,
        coverImageUrl: null,
        daysCount: 2,
        totalDays: 2,
        estimatedBudget: 500000,
        totalEstimatedBudget: 500000,
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        transportationMode: 'CAR',
        isCustom: false,
        isPublic: false,
        isSaved: true,
        shareToken: null,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-11'),
        startTime: '08:30',
        startLocation: JSON.stringify({
          name: 'Bandara Internasional Lombok',
          latitude: -8.7588,
          longitude: 116.2764,
        }),
        endLocation: null,
        totalDistanceKm: 120,
        totalTravelTimeMinutes: 180,
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [
          {
            id: 'day_1',
            itineraryId: 'itin_multi_day',
            dayNumber: 1,
            title: 'Hari 1',
            date: new Date('2026-09-10'),
            startTime: '08:30',
            startLocation: null,
            notes: null,
            totalDistanceKm: 45,
            totalTravelTimeMinutes: 70,
            estimatedBudget: 250000,
            items: [
              {
                id: 'act_1_1',
                itineraryDayId: 'day_1',
                orderIndex: 0,
                itemType: 'DESTINATION',
                destinationId: 'dest_tanjung_aan',
                destination: {
                  id: 'dest_tanjung_aan',
                  name: 'Pantai Tanjung Aan',
                  latitude: -8.9082,
                  longitude: 116.3195,
                },
                startTime: '09:30',
                endTime: '12:00',
                timeSlot: '09:30 - 12:00',
                estimatedDurationMinutes: 150,
                estimatedCost: 15000,
                distanceFromPrevKm: 25,
                travelTimeFromPrevMinutes: 40,
                isCompleted: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
          {
            id: 'day_2',
            itineraryId: 'itin_multi_day',
            dayNumber: 2,
            title: 'Hari 2',
            date: new Date('2026-09-11'),
            startTime: '08:30',
            startLocation: null, // No explicit start -> chained from Day 1 last activity!
            notes: null,
            totalDistanceKm: 75,
            totalTravelTimeMinutes: 110,
            estimatedBudget: 250000,
            items: [
              {
                id: 'act_2_1',
                itineraryDayId: 'day_2',
                orderIndex: 0,
                itemType: 'DESTINATION',
                destinationId: 'dest_merese',
                destination: {
                  id: 'dest_merese',
                  name: 'Bukit Merese',
                  latitude: -8.915,
                  longitude: 116.315,
                },
                startTime: '09:00',
                endTime: '11:00',
                timeSlot: '09:00 - 11:00',
                estimatedDurationMinutes: 120,
                estimatedCost: 10000,
                distanceFromPrevKm: 2.5,
                travelTimeFromPrevMinutes: 8,
                isCompleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
        ],
      };

      const dto = (service as any).mapToDto(multiDayItinerary);

      // Day 1 starts from master itinerary startLocation
      expect(dto.days[0].startLocation?.name).toBe('Bandara Internasional Lombok');
      expect(dto.days[0].isCustomStartLocation).toBe(false);

      // Day 2 automatically chained from Day 1's last activity (Pantai Tanjung Aan)
      expect(dto.days[1].startLocation?.name).toBe('Pantai Tanjung Aan');
      expect(dto.days[1].startLocation?.latitude).toBe(-8.9082);
      expect(dto.days[1].startLocation?.longitude).toBe(116.3195);
      expect(dto.days[1].startLocation?.isChainedFromPreviousDay).toBe(true);
      expect(dto.days[1].isCustomStartLocation).toBe(false);
    });

    it('should respect user custom start location on Day 2 in mapToDto', () => {
      const multiDayItineraryWithCustomDay2 = {
        id: 'itin_multi_day_custom',
        userId: 'user_1',
        title: '2 Hari Trip Lombok',
        description: null,
        coverImageUrl: null,
        daysCount: 2,
        totalDays: 2,
        estimatedBudget: 500000,
        totalEstimatedBudget: 500000,
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        transportationMode: 'CAR',
        isCustom: false,
        isPublic: false,
        isSaved: true,
        shareToken: null,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-11'),
        startTime: '08:30',
        startLocation: JSON.stringify({
          name: 'Bandara Internasional Lombok',
          latitude: -8.7588,
          longitude: 116.2764,
        }),
        endLocation: null,
        totalDistanceKm: 120,
        totalTravelTimeMinutes: 180,
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [
          {
            id: 'day_1',
            itineraryId: 'itin_multi_day_custom',
            dayNumber: 1,
            title: 'Hari 1',
            date: new Date('2026-09-10'),
            startTime: '08:30',
            startLocation: null,
            notes: null,
            totalDistanceKm: 45,
            totalTravelTimeMinutes: 70,
            estimatedBudget: 250000,
            items: [],
          },
          {
            id: 'day_2',
            itineraryId: 'itin_multi_day_custom',
            dayNumber: 2,
            title: 'Hari 2',
            date: new Date('2026-09-11'),
            startTime: '08:00',
            startLocation: JSON.stringify({
              name: 'Novotel Lombok Resort',
              latitude: -8.892,
              longitude: 116.295,
              address: 'Pantai Mandalika',
            }),
            notes: null,
            totalDistanceKm: 50,
            totalTravelTimeMinutes: 60,
            estimatedBudget: 250000,
            items: [],
          },
        ],
      };

      const dto = (service as any).mapToDto(multiDayItineraryWithCustomDay2);

      // Day 2 has custom start location override
      expect(dto.days[1].startLocation?.name).toBe('Novotel Lombok Resort');
      expect(dto.days[1].startLocation?.isChainedFromPreviousDay).toBe(false);
      expect(dto.days[1].isCustomStartLocation).toBe(true);
    });

    it('should update day start location from accommodation reference and recalculate', async () => {
      const mockDay = {
        id: 'day_2',
        itineraryId: 'itin_1',
        dayNumber: 2,
        title: 'Hari 2',
        startTime: '08:30',
        startLocation: null,
        itinerary: {
          id: 'itin_1',
          userId: 'user_1',
          transportationMode: 'CAR',
        },
        items: [
          {
            id: 'item_1',
            orderIndex: 0,
            destinationId: 'dest_1',
            destination: { id: 'dest_1', name: 'Pantai Kuta', latitude: -8.89, longitude: 116.28 },
            estimatedDurationMinutes: 60,
            estimatedCost: 10000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.findAccommodationById.mockResolvedValue({
        id: 'accom_1',
        name: 'Pullman Lombok Merujani',
        latitude: -8.895,
        longitude: 116.305,
        address: 'Mandalika, Kuta',
      });
      mockRepo.findById.mockResolvedValue({
        id: 'itin_1',
        userId: 'user_1',
        title: 'Trip 1',
        daysCount: 2,
        totalDays: 2,
        transportationMode: 'CAR',
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [mockDay],
      });
      mockRepo.updateDay.mockResolvedValue({
        ...mockDay,
        startLocation: JSON.stringify({
          name: 'Pullman Lombok Merujani',
          latitude: -8.895,
          longitude: 116.305,
          address: 'Mandalika, Kuta',
          accommodationId: 'accom_1',
        }),
      });

      const result = await service.updateDayStart('user_1', 'USER', 'itin_1', 'day_2', {
        startLocation: {
          accommodationId: 'accom_1',
        },
        startTime: '08:00',
      });

      expect(mockRepo.findAccommodationById).toHaveBeenCalledWith('accom_1');
      expect(mockRepo.updateDay).toHaveBeenCalledWith('day_2', expect.objectContaining({
        startTime: '08:00',
        startLocation: expect.stringContaining('Pullman Lombok Merujani'),
      }));
      expect(result).toBeDefined();
    });

    it('should reset day start location to null to restore automatic chaining', async () => {
      const mockDay = {
        id: 'day_2',
        itineraryId: 'itin_1',
        dayNumber: 2,
        title: 'Hari 2',
        startTime: '08:30',
        startLocation: JSON.stringify({ name: 'Custom Point', latitude: -8.8, longitude: 116.2 }),
        itinerary: {
          id: 'itin_1',
          userId: 'user_1',
          transportationMode: 'CAR',
        },
        items: [],
      };

      mockRepo.findDayById.mockResolvedValue(mockDay);
      mockRepo.findById.mockResolvedValue({
        id: 'itin_1',
        userId: 'user_1',
        title: 'Trip 1',
        daysCount: 2,
        totalDays: 2,
        transportationMode: 'CAR',
        createdAt: new Date(),
        updatedAt: new Date(),
        days: [mockDay],
      });
      mockRepo.updateDay.mockResolvedValue({
        ...mockDay,
        startLocation: null,
      });

      await service.updateDayStart('user_1', 'USER', 'itin_1', 'day_2', {
        startLocation: null,
      });

      expect(mockRepo.updateDay).toHaveBeenCalledWith('day_2', expect.objectContaining({
        startLocation: null,
      }));
    });
  });
});
