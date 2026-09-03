import * as crypto from 'crypto';
import {
  Category,
  Destination,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  TransportationMode,
} from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { itinerariesRepository, ItinerariesRepository } from './itineraries.repository';
import {
  ActiveTripResponseDto,
  AddActivityDto,
  AddDayDto,
  ApplyTemplateDto,
  BrowseItineraryQuery,
  BrowseTemplatesResponseDto,
  CreateItineraryDto,
  CustomLocation,
  DestinationSummaryDto,
  ItineraryActivityDto,
  ItineraryDayDto,
  ItineraryDto,
  ItineraryQuery,
  ItineraryTemplateDto,
  OptimizeItineraryDto,
  RecommendationsQuery,
  ReorderActivitiesDto,
  RouteSegmentDto,
  TemplateActivityDto,
  UpdateActivityDto,
  UpdateDayDto,
  UpdateItineraryDto,
} from './dto/itinerary.dto';
import { PaginationMeta } from '../../common/types';
import { mapboxMatrixService, MapboxMatrixService } from './services/mapbox-matrix.service';
import {
  mapboxOptimizationService,
  MapboxOptimizationService,
} from './services/mapbox-optimization.service';
import { GeoCoordinate } from './services/mapbox.types';

export type ItineraryItemWithDestination = ItineraryItem & {
  destination?: (Destination & { category?: Category | null }) | null;
};

export type ItineraryDayWithItems = ItineraryDay & {
  items: ItineraryItemWithDestination[];
};

export type ItineraryWithRelations = Itinerary & {
  days: ItineraryDayWithItems[];
};

export class ItinerariesService {
  constructor(
    private readonly repository: ItinerariesRepository = itinerariesRepository,
    private readonly matrixService: MapboxMatrixService = mapboxMatrixService,
    private readonly optimizationService: MapboxOptimizationService = mapboxOptimizationService,
  ) {}

  /**
   * Helper to safely parse JSON location strings into CustomLocation objects.
   */
  private parseLocation(loc: string | null | undefined): CustomLocation | null {
    if (!loc) return null;
    if (typeof loc === 'object') return loc as CustomLocation;
    try {
      return JSON.parse(loc) as CustomLocation;
    } catch {
      return null;
    }
  }

  /**
   * Transforms raw Prisma entity into client-friendly DTO.
   */
  public mapToDto(itinerary: ItineraryWithRelations): ItineraryDto {
    let totalDist = 0;
    let totalDur = 0;
    let totalBudget = 0;
    let totalDestinationsCount = 0;

    const days: ItineraryDayDto[] = Array.isArray(itinerary.days)
      ? itinerary.days.map((day: ItineraryDayWithItems) => {
          let dayDist = 0;
          let dayDur = 0;
          let dayBudget = 0;
          const segments: RouteSegmentDto[] = [];

          const rawItems = Array.isArray(day.items)
            ? [...day.items].sort((a, b) => a.orderIndex - b.orderIndex)
            : [];

          totalDestinationsCount += rawItems.length;

          const activities: ItineraryActivityDto[] = rawItems.map((item, idx) => {
            const cost = Number(item.estimatedCost) || 0;
            const dist = Number(item.distanceFromPrevKm) || 0;
            const dur = Number(item.travelTimeFromPrevMinutes) || 0;

            dayBudget += cost;
            dayDist += dist;
            dayDur += dur;

            const customLoc = this.parseLocation(item.customLocation);

            let startTime = item.startTime || null;
            let endTime = item.endTime || null;
            let timeSlot = item.timeSlot || null;

            if (!timeSlot && startTime && endTime) {
              timeSlot = `${startTime} - ${endTime}`;
            } else if (timeSlot && !startTime && timeSlot.includes('-')) {
              const parts = timeSlot.split('-');
              startTime = parts[0]?.trim() || null;
              endTime = parts[1]?.trim() || null;
            }

            if (idx > 0) {
              const prevItem = rawItems[idx - 1]!;
              segments.push({
                fromActivityId: prevItem.id,
                toActivityId: item.id,
                distanceKm: dist,
                travelTimeMinutes: dur,
              });
            }

            const categoryObj = item.destination?.category
              ? {
                  id: item.destination.category.id,
                  name: item.destination.category.name,
                  slug: item.destination.category.slug,
                }
              : null;
            const categoryName = item.destination?.category?.name || 'Aktivitas Wisata';
            const imgUrl = item.destination?.coverImageUrl || null;

            const destinationSummary: DestinationSummaryDto | null = item.destination
              ? {
                  id: item.destination.id,
                  name: item.destination.name,
                  slug: item.destination.slug,
                  category: categoryObj,
                  categoryName: categoryName,
                  imageUrl: imgUrl,
                  coverImageUrl: imgUrl,
                  rating: item.destination.rating,
                  region: item.destination.region || null,
                  latitude: item.destination.latitude,
                  longitude: item.destination.longitude,
                }
              : null;

            return {
              id: item.id,
              dayId: item.itineraryDayId,
              orderIndex: item.orderIndex,
              timeSlot,
              startTime,
              endTime,
              destinationId: item.destinationId,
              destination: destinationSummary,
              destinationName: item.destination?.name || customLoc?.name || item.customTitle || 'Aktivitas Trip',
              destinationCategory: categoryName,
              imageUrl: imgUrl,
              coverImageUrl: imgUrl,
              customLocation: customLoc,
              customTitle: item.customTitle,
              activityNotes: item.activityNotes,
              notes: item.activityNotes,
              estimatedDurationMinutes: item.estimatedDurationMinutes,
              estimatedCost: cost,
              distanceFromPrevKm: dist,
              travelDurationMinutes: dur,
              travelTimeFromPrevMinutes: dur,
              isCompleted: Boolean(item.isCompleted),
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            };
          });

          totalDist += dayDist;
          totalDur += dayDur;
          totalBudget += dayBudget;

          return {
            id: day.id,
            itineraryId: day.itineraryId,
            dayNumber: day.dayNumber,
            title: day.title,
            date: day.date ? new Date(day.date).toISOString().split('T')[0] ?? null : null,
            notes: day.notes,
            totalDistanceKm: Math.round(dayDist * 100) / 100,
            totalDurationMinutes: Math.round(dayDur),
            totalTravelTimeMinutes: Math.round(dayDur),
            estimatedBudget: dayBudget,
            segments,
            activities,
            items: activities,
          };
        })
      : [];

    const shareToken = itinerary.shareToken || null;
    const shareUrl = shareToken ? `https://lombokexplorer.com/trips/share/${shareToken}` : null;

    return {
      id: itinerary.id,
      userId: itinerary.userId,
      title: itinerary.title,
      description: itinerary.description,
      coverImageUrl: itinerary.coverImageUrl,
      daysCount: itinerary.totalDays || days.length || 1,
      totalDays: itinerary.totalDays || days.length || 1,
      estimatedBudget: totalBudget || Number(itinerary.totalEstimatedBudget) || 0,
      totalEstimatedBudget: totalBudget || Number(itinerary.totalEstimatedBudget) || 0,
      totalDistanceKm: Math.round(totalDist * 10) / 10 || Number(itinerary.totalDistanceKm) || 0,
      totalDurationMinutes: Math.round(totalDur) || Number(itinerary.totalTravelTimeMinutes) || 0,
      totalTravelTimeMinutes: Math.round(totalDur) || Number(itinerary.totalTravelTimeMinutes) || 0,
      totalDestination: totalDestinationsCount,
      todalDestination: totalDestinationsCount,
      totalDestinations: totalDestinationsCount,
      destinationCount: totalDestinationsCount,
      travelStyle: itinerary.travelStyle,
      budgetLevel: itinerary.budgetLevel,
      transportationMode: itinerary.transportationMode || 'CAR',
      startLocation: this.parseLocation(itinerary.startLocation),
      endLocation: this.parseLocation(itinerary.endLocation),
      pace: itinerary.pace,
      isCustom: Boolean(itinerary.isCustom),
      isPublic: itinerary.isPublic,
      isSaved: itinerary.isSaved,
      shareToken,
      shareUrl,
      startDate: itinerary.startDate ? new Date(itinerary.startDate).toISOString().split('T')[0] ?? null : null,
      endDate: itinerary.endDate ? new Date(itinerary.endDate).toISOString().split('T')[0] ?? null : null,
      days,
      createdAt: itinerary.createdAt.toISOString(),
      updatedAt: itinerary.updatedAt.toISOString(),
    };
  }

  /**
   * Helper to format minutes from midnight (0...1440) to "HH:mm" in Asia/Makassar (WITA)
   */
  private formatTimeFromMinutes(totalMinutes: number): string {
    const norm = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private parseTimeToMinutes(timeStr?: string | null): number | null {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (typeof h !== 'number' || typeof m !== 'number' || isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  /**
   * Recalculates distances, transit times, and schedule for a single day.
   */
  public async recalculateDayRouteAndSchedule(
    dayId: string,
    transportationMode: TransportationMode = 'CAR',
  ) {
    const day = await this.repository.findDayById(dayId);
    if (!day) return;

    const items = [...day.items].sort((a, b) => a.orderIndex - b.orderIndex);
    if (items.length === 0) {
      await this.repository.updateDayTotals(dayId, {
        totalDistanceKm: 0,
        totalTravelTimeMinutes: 0,
        estimatedBudget: 0,
      });
      return;
    }

    // 1. Collect coordinates
    const coordinates: GeoCoordinate[] = [];
    for (const item of items) {
      if (item.destination?.latitude && item.destination?.longitude) {
        coordinates.push({
          id: item.id,
          name: item.destination.name,
          latitude: item.destination.latitude,
          longitude: item.destination.longitude,
        });
      } else if (item.customLocation) {
        const parsed = this.parseLocation(item.customLocation);
        if (parsed) {
          coordinates.push({
            id: item.id,
            name: parsed.name,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          });
        }
      }
    }

    // 2. Compute matrix if we have coordinates for activities
    const matrix =
      coordinates.length > 1
        ? await this.matrixService.calculateMatrix(coordinates, transportationMode)
        : { distancesKm: [[0]], durationsMinutes: [[0]] };

    let currentMinutes = this.parseTimeToMinutes(items[0]?.startTime) ?? 8 * 60 + 30; // default 08:30 AM WITA
    let dayDist = 0;
    let dayDur = 0;
    let dayBudget = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const cost = Number(item.estimatedCost) || 0;
      dayBudget += cost;

      let dist = 0;
      let dur = 0;

      if (i > 0 && matrix.distancesKm[i - 1]?.[i] !== undefined) {
        dist = matrix.distancesKm[i - 1]![i]!;
        dur = matrix.durationsMinutes[i - 1]![i]!;
      }

      dayDist += dist;
      dayDur += dur;

      currentMinutes += dur; // Add transit time
      const startTime = this.formatTimeFromMinutes(currentMinutes);
      currentMinutes += item.estimatedDurationMinutes; // Add activity duration
      const endTime = this.formatTimeFromMinutes(currentMinutes);
      const timeSlot = `${startTime} - ${endTime}`;

      await this.repository.updateActivity(item.id, {
        distanceFromPrevKm: dist,
        travelTimeFromPrevMinutes: dur,
        startTime,
        endTime,
        timeSlot,
      });
    }

    await this.repository.updateDayTotals(dayId, {
      totalDistanceKm: Math.round(dayDist * 100) / 100,
      totalTravelTimeMinutes: Math.round(dayDur),
      estimatedBudget: dayBudget,
    });

    // Update parent itinerary totals
    const itinerary = await this.repository.findById(day.itineraryId);
    if (itinerary) {
      let itinDist = 0;
      let itinDur = 0;
      let itinBudget = 0;

      for (const d of itinerary.days) {
        for (const it of d.items) {
          itinDist += Number(it.distanceFromPrevKm) || 0;
          itinDur += Number(it.travelTimeFromPrevMinutes) || 0;
          itinBudget += Number(it.estimatedCost) || 0;
        }
      }

      const finalBudget = Math.max(Number(itinerary.totalEstimatedBudget) || 0, itinBudget);

      await this.repository.updateItineraryTotals(itinerary.id, {
        totalDistanceKm: Math.round(itinDist * 100) / 100,
        totalTravelTimeMinutes: Math.round(itinDur),
        totalEstimatedBudget: finalBudget,
      });
    }
  }

  public async getItineraries(
    query: ItineraryQuery,
    userId?: string,
  ): Promise<{ data: ItineraryDto[]; meta: PaginationMeta }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    if (!userId) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const { items, total } = await this.repository.findMany({
      userId,
      travelStyle: query.travelStyle,
      budgetLevel: query.budgetLevel,
      transportationMode: query.transportationMode,
      search: query.search,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit) || 0;

    return {
      data: items.map((item: ItineraryWithRelations) => this.mapToDto(item)),
      meta: { page, limit, total, totalPages },
    };
  }

  public async getItineraryById(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<ItineraryDto> {
    const reservedWords = [
      'browse',
      'recommendations',
      'active',
      'active-trip',
      'apply',
      'generate',
      'templates',
      'shared',
    ];
    if (reservedWords.includes(id.toLowerCase())) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    const itinerary = await this.repository.findById(id);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to view this private itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.mapToDto(itinerary as ItineraryWithRelations);
  }

  public async getSharedItinerary(shareToken: string): Promise<ItineraryDto> {
    const itinerary = await this.repository.findByShareToken(shareToken);
    if (!itinerary) {
      throw new NotFoundError('Shared itinerary not found or expired', 'SHARED_ITINERARY_NOT_FOUND');
    }
    return this.mapToDto(itinerary as ItineraryWithRelations);
  }

  public async createItinerary(userId: string, dto: CreateItineraryDto): Promise<ItineraryDto> {
    const daysCount = dto.daysCount || dto.totalDays || (dto.days ? dto.days.length : 1);
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    let initialDays: { title: string; date?: Date | null; notes?: string | null; items?: unknown[] }[] = [];

    if (dto.days && dto.days.length > 0) {
      initialDays = dto.days.map((d, i) => ({
        title: d.title || `Hari ${i + 1}`,
        date: d.date ? new Date(d.date) : null,
        notes: d.notes,
        items: d.activities || d.items || [],
      }));
    } else {
      for (let i = 1; i <= daysCount; i++) {
        let dayDate: Date | null = null;
        if (startDate) {
          dayDate = new Date(startDate.getTime());
          dayDate.setDate(dayDate.getDate() + (i - 1));
        }
        initialDays.push({
          title: `Hari ${i}`,
          date: dayDate,
          notes: null,
          items: [],
        });
      }
    }

    const startLocationStr = dto.startLocation ? JSON.stringify(dto.startLocation) : null;
    const endLocationStr = dto.endLocation ? JSON.stringify(dto.endLocation) : null;

    const initialBudget =
      dto.totalEstimatedBudget !== undefined
        ? Number(dto.totalEstimatedBudget)
        : initialDays.reduce(
            (acc, d) =>
              acc +
              (d.items
                ? (d.items as any[]).reduce(
                    (s: number, it: any) => s + (Number(it.estimatedCost) || 0),
                    0,
                  )
                : 0),
            0,
          );

    const created = await this.repository.createWithTransaction(
      {
        userId,
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        totalDays: initialDays.length,
        totalEstimatedBudget: initialBudget,
        travelStyle: dto.travelStyle,
        budgetLevel: dto.budgetLevel,
        transportationMode: dto.transportationMode,
        startLocation: startLocationStr,
        endLocation: endLocationStr,
        pace: dto.pace,
        isCustom: true,
        isPublic: dto.isPublic,
        startDate,
        endDate,
      },
      initialDays,
    );

    // If activities were included, calculate routes
    for (const d of created.days) {
      if (d.items.length > 0) {
        await this.recalculateDayRouteAndSchedule(d.id, dto.transportationMode);
      }
    }

    const fresh = await this.repository.findById(created.id);
    return this.mapToDto(fresh as ItineraryWithRelations);
  }

  public async updateItinerary(
    userId: string,
    userRole: string,
    id: string,
    dto: UpdateItineraryDto,
  ): Promise<ItineraryDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    const startLocationStr =
      dto.startLocation !== undefined
        ? dto.startLocation ? JSON.stringify(dto.startLocation) : null
        : undefined;

    const endLocationStr =
      dto.endLocation !== undefined
        ? dto.endLocation ? JSON.stringify(dto.endLocation) : null
        : undefined;

    const startDate =
      dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined;

    await this.repository.updateMasterData(id, {
      title: dto.title,
      description: dto.description,
      coverImageUrl: dto.coverImageUrl,
      travelStyle: dto.travelStyle,
      budgetLevel: dto.budgetLevel,
      transportationMode: dto.transportationMode,
      startLocation: startLocationStr,
      endLocation: endLocationStr,
      pace: dto.pace,
      isPublic: dto.isPublic,
      isSaved: dto.isSaved,
      startDate,
      endDate,
      ...(dto.totalEstimatedBudget !== undefined && {
        totalEstimatedBudget: Number(dto.totalEstimatedBudget),
      }),
    });

    const updated = await this.repository.findById(id);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteItinerary(userId: string, userRole: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(id);
  }

  public async duplicateItinerary(userId: string, id: string): Promise<ItineraryDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    const daysInput = existing.days.map((d) => ({
      title: d.title,
      date: d.date,
      notes: d.notes,
      items: d.items.map((it) => ({
        destinationId: it.destinationId,
        customLocation: it.customLocation,
        customTitle: it.customTitle,
        orderIndex: it.orderIndex,
        timeSlot: it.timeSlot,
        startTime: it.startTime,
        endTime: it.endTime,
        activityNotes: it.activityNotes,
        estimatedDurationMinutes: it.estimatedDurationMinutes,
        estimatedCost: Number(it.estimatedCost),
        distanceFromPrevKm: Number(it.distanceFromPrevKm),
        travelTimeFromPrevMinutes: Number(it.travelTimeFromPrevMinutes),
        isCompleted: false,
      })),
    }));

    const cloned = await this.repository.createWithTransaction(
      {
        userId,
        title: `${existing.title} (Copy)`,
        description: existing.description,
        coverImageUrl: existing.coverImageUrl,
        totalDays: existing.totalDays,
        totalEstimatedBudget: Number(existing.totalEstimatedBudget),
        travelStyle: existing.travelStyle,
        budgetLevel: existing.budgetLevel,
        transportationMode: existing.transportationMode,
        startLocation: existing.startLocation,
        endLocation: existing.endLocation,
        pace: existing.pace,
        isCustom: true,
        isPublic: false,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
      daysInput,
    );

    return this.mapToDto(cloned as ItineraryWithRelations);
  }

  public async generateShareToken(userId: string, userRole: string, id: string): Promise<{ shareToken: string; shareUrl: string }> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to share this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    const shareToken = existing.shareToken || crypto.randomBytes(8).toString('hex');
    await this.repository.updateMasterData(id, { shareToken });

    return {
      shareToken,
      shareUrl: `https://lombokexplorer.com/trips/share/${shareToken}`,
    };
  }

  // --- DAY MANAGEMENT ---
  public async addDay(
    userId: string,
    userRole: string,
    itineraryId: string,
    dto: AddDayDto,
  ): Promise<ItineraryDto> {
    const itinerary = await this.repository.findById(itineraryId);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${itineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to modify this itinerary', 'FORBIDDEN_RESOURCE');
    }

    const date = dto.date ? new Date(dto.date) : null;
    await this.repository.addDay(itineraryId, {
      title: dto.title,
      date,
      notes: dto.notes,
    });

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async updateDay(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: UpdateDayDto,
  ): Promise<ItineraryDto> {
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== itineraryId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to modify this day', 'FORBIDDEN_RESOURCE');
    }

    const date = dto.date !== undefined ? (dto.date ? new Date(dto.date) : null) : undefined;
    await this.repository.updateDay(dayId, {
      title: dto.title,
      date,
      notes: dto.notes,
    });

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteDay(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
  ): Promise<ItineraryDto> {
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== itineraryId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete this day', 'FORBIDDEN_RESOURCE');
    }

    await this.repository.deleteDayAndReindex(itineraryId, dayId);

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  // --- ACTIVITY / STOP MANAGEMENT ---
  public async addActivity(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: AddActivityDto,
  ): Promise<ItineraryDto> {
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== itineraryId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to add activities to this trip', 'FORBIDDEN_RESOURCE');
    }

    // If destinationId provided, validate existence
    if (dto.destinationId) {
      const dest = await prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true, name: true, status: true },
      });
      if (!dest) {
        throw new NotFoundError(`Destination '${dto.destinationId}' not found`, 'DESTINATION_NOT_FOUND');
      }
    }

    const customLocationStr = dto.customLocation ? JSON.stringify(dto.customLocation) : null;

    await this.repository.addActivity(dayId, {
      destinationId: dto.destinationId,
      customLocation: customLocationStr,
      customTitle: dto.customTitle,
      orderIndex: dto.orderIndex,
      startTime: dto.startTime,
      endTime: dto.endTime,
      timeSlot: dto.timeSlot,
      activityNotes: dto.activityNotes || dto.notes,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      estimatedCost: dto.estimatedCost,
    });

    await this.recalculateDayRouteAndSchedule(dayId, day.itinerary.transportationMode);

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async updateActivity(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    activityId: string,
    dto: UpdateActivityDto,
  ): Promise<ItineraryDto> {
    const activity = await this.repository.findActivityById(activityId);
    if (!activity || activity.itineraryDayId !== dayId || activity.itineraryDay.itineraryId !== itineraryId) {
      throw new NotFoundError(`Activity '${activityId}' not found in specified day`, 'ACTIVITY_NOT_FOUND');
    }

    if (activity.itineraryDay.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to modify this activity', 'FORBIDDEN_RESOURCE');
    }

    const customLocationStr =
      dto.customLocation !== undefined
        ? dto.customLocation ? JSON.stringify(dto.customLocation) : null
        : undefined;

    await this.repository.updateActivity(activityId, {
      destinationId: dto.destinationId,
      customLocation: customLocationStr,
      customTitle: dto.customTitle,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      estimatedCost: dto.estimatedCost,
      activityNotes: dto.activityNotes !== undefined ? dto.activityNotes : dto.notes,
      startTime: dto.startTime,
      endTime: dto.endTime,
      timeSlot: dto.timeSlot,
      isCompleted: dto.isCompleted,
    });

    await this.recalculateDayRouteAndSchedule(dayId, activity.itineraryDay.itinerary.transportationMode);

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteActivity(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    activityId: string,
  ): Promise<ItineraryDto> {
    const activity = await this.repository.findActivityById(activityId);
    if (!activity || activity.itineraryDayId !== dayId || activity.itineraryDay.itineraryId !== itineraryId) {
      throw new NotFoundError(`Activity '${activityId}' not found in specified day`, 'ACTIVITY_NOT_FOUND');
    }

    if (activity.itineraryDay.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete this activity', 'FORBIDDEN_RESOURCE');
    }

    await this.repository.deleteActivityAndReindex(dayId, activityId);
    await this.recalculateDayRouteAndSchedule(dayId, activity.itineraryDay.itinerary.transportationMode);

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async reorderActivities(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: ReorderActivitiesDto,
  ): Promise<ItineraryDto> {
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== itineraryId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to reorder activities in this trip', 'FORBIDDEN_RESOURCE');
    }

    const dayItemIds = new Set(day.items.map((it) => it.id));
    for (const item of dto.activities) {
      if (!dayItemIds.has(item.id)) {
        throw new ValidationError(`Activity '${item.id}' does not belong to Day '${dayId}'`);
      }
    }

    await this.repository.reorderActivities(dayId, dto.activities);
    await this.recalculateDayRouteAndSchedule(dayId, day.itinerary.transportationMode);

    const updated = await this.repository.findById(itineraryId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  // --- ROUTE OPTIMIZATION ---
  public async optimizeRoute(
    userId: string,
    userRole: string,
    itineraryId: string,
    dto: OptimizeItineraryDto,
  ): Promise<ItineraryDto> {
    const itinerary = await this.repository.findById(itineraryId);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${itineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to optimize this trip', 'FORBIDDEN_RESOURCE');
    }

    const targetDays = dto.dayId
      ? itinerary.days.filter((d) => d.id === dto.dayId)
      : itinerary.days;

    if (targetDays.length === 0) {
      throw new NotFoundError(`Specified day not found in itinerary`, 'DAY_NOT_FOUND');
    }

    for (const day of targetDays) {
      const items = [...day.items].sort((a, b) => a.orderIndex - b.orderIndex);
      if (items.length <= 1) continue;

      const coords: GeoCoordinate[] = [];
      for (const item of items) {
        if (item.destination?.latitude && item.destination?.longitude) {
          coords.push({
            id: item.id,
            name: item.destination.name,
            latitude: item.destination.latitude,
            longitude: item.destination.longitude,
          });
        } else if (item.customLocation) {
          const parsed = this.parseLocation(item.customLocation);
          if (parsed) {
            coords.push({
              id: item.id,
              name: parsed.name,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            });
          }
        }
      }

      if (coords.length > 1) {
        const optResult = await this.optimizationService.optimizeRoute(
          coords,
          itinerary.transportationMode,
          0,
        );

        // Map optimized indices back to items
        const reorderPayload = optResult.orderedIndices.map((origIdx, newOrder) => ({
          id: coords[origIdx]!.id!,
          orderIndex: newOrder,
        }));

        await this.repository.reorderActivities(day.id, reorderPayload);
        await this.recalculateDayRouteAndSchedule(day.id, itinerary.transportationMode);
      }
    }

    const fresh = await this.repository.findById(itineraryId);
    return this.mapToDto(fresh as ItineraryWithRelations);
  }

  /**
   * Retrieves the active trip card summary for the authenticated user's home screen widget.
   * Ensures strict multi-tenant user isolation (users only see their own trips, new users have 0 trips).
   */
  public async getActiveTrip(userId?: string): Promise<ActiveTripResponseDto> {
    if (!userId) {
      return {
        hasActiveTrip: false,
        trip: null,
      };
    }

    const itinerary = await this.repository.findActiveTripByUserId(userId);
    if (!itinerary) {
      return {
        hasActiveTrip: false,
        trip: null,
      };
    }

    const days = itinerary.days || [];
    const totalDays = itinerary.totalDays || days.length || 1;

    // Determine current active day:
    // 1. Pick the first incomplete day (having at least one item with !isCompleted)
    // 2. Otherwise default to Day 1
    const activeDay = days.find((d) => d.items.some((item) => !item.isCompleted)) || days[0];
    const activeDayNumber = activeDay ? activeDay.dayNumber : 1;

    let totalActivitiesCount = 0;
    let completedActivitiesCount = 0;
    let totalDist = 0;

    for (const day of days) {
      totalDist += Number(day.totalDistanceKm) || 0;
      for (const item of day.items) {
        totalActivitiesCount++;
        if (item.isCompleted) {
          completedActivitiesCount++;
        }
      }
    }

    const activeDayActivitiesCount = activeDay ? activeDay.items.length : 0;
    const rawDayTitle = activeDay?.title || `Hari ${activeDayNumber}`;

    // Clean focus day title for subtitle
    let focusTitle = rawDayTitle;
    if (/^hari\s+\d+\s*:\s*/i.test(focusTitle)) {
      focusTitle = focusTitle.replace(/^hari\s+\d+\s*:\s*/i, '');
    }
    const focusText = `Fokus: Hari ${activeDayNumber}: ${focusTitle} (${activeDayActivitiesCount} Destinasi)`;

    const totalDistKm = Math.round((Number(itinerary.totalDistanceKm) || totalDist) * 10) / 10;
    const distanceFormatted = `${totalDistKm} km`;
    const badgeText = `Hari ${activeDayNumber} dari ${totalDays} Hari`;
    const shareToken = itinerary.shareToken || null;
    const shareUrl = shareToken ? `https://lombokexplorer.com/trips/share/${shareToken}` : null;

    const progressPercentage =
      totalActivitiesCount > 0
        ? Math.round((completedActivitiesCount / totalActivitiesCount) * 100)
        : 0;

    return {
      hasActiveTrip: true,
      trip: {
        id: itinerary.id,
        title: itinerary.title,
        description: itinerary.description,
        coverImageUrl: itinerary.coverImageUrl,
        transportationMode: itinerary.transportationMode,
        totalDays,
        currentDayNumber: activeDayNumber,
        badgeText,
        totalDistanceKm: totalDistKm,
        distanceFormatted,
        totalDestination: totalActivitiesCount,
        todalDestination: totalActivitiesCount,
        totalDestinations: totalActivitiesCount,
        destinationCount: totalActivitiesCount,
        focus: {
          dayNumber: activeDayNumber,
          dayTitle: rawDayTitle,
          activityCount: activeDayActivitiesCount,
          focusText,
        },
        progress: {
          totalActivities: totalActivitiesCount,
          completedActivities: completedActivitiesCount,
          percentage: progressPercentage,
          isCompleted:
            totalActivitiesCount > 0 && completedActivitiesCount === totalActivitiesCount,
        },
        shareToken,
        shareUrl,
        startDate: itinerary.startDate ? itinerary.startDate.toISOString() : null,
        endDate: itinerary.endDate ? itinerary.endDate.toISOString() : null,
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString(),
      },
    };
  }

  public async getRecommendations(query: RecommendationsQuery): Promise<ItineraryTemplateDto[]> {
    const templates = await this.repository.findRecommendations(query);
    return templates.map((t: any) => this.mapTemplateToDto(t));
  }

  public async browseTemplates(
    query: BrowseItineraryQuery,
  ): Promise<BrowseTemplatesResponseDto> {
    const rawPage = Number(query.page);
    const rawLimit = Number(query.limit);

    const page = !isNaN(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(100, Math.floor(rawLimit)) : 10;

    const { items, total } = await this.repository.findBrowseTemplates({
      ...query,
      page,
      limit,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const hasNext = page < totalPages;

    const returnedItems =
      page > totalPages && total > 0 ? [] : items.map((t: any) => this.mapTemplateToDto(t));

    return {
      items: returnedItems,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNext,
      },
    };
  }

  public async getTemplateById(id: string): Promise<ItineraryTemplateDto> {
    const template = await this.repository.findTemplateById(id);
    if (!template || !template.isPublished) {
      throw new NotFoundError(
        `Curated itinerary template with ID '${id}' not found`,
        'TEMPLATE_NOT_FOUND',
      );
    }
    return this.mapTemplateToDto(template);
  }

  public async applyTemplate(body: ApplyTemplateDto, userId: string): Promise<ItineraryDto> {
    if (!userId) {
      throw new ValidationError('User authentication is required to apply an itinerary template');
    }

    const template = await this.repository.findTemplateById(body.templateId);
    if (!template || !template.isPublished) {
      throw new NotFoundError(
        `Curated itinerary template with ID '${body.templateId}' not found or is not published`,
        'TEMPLATE_NOT_FOUND',
      );
    }

    const cloned = await this.repository.cloneTemplateToUserItinerary(
      template as any,
      userId,
      body.customTitle,
      body.startDate || undefined,
    );

    return this.mapToDto(cloned as unknown as ItineraryWithRelations);
  }

  private mapTemplateToDto(template: any): ItineraryTemplateDto {
    const days = template.days || [];
    let totalDestCount = 0;
    const destNames: string[] = [];

    const mappedDays = days.map((day: any) => {
      const activities = day.activities || [];
      totalDestCount += activities.length;

      const mappedActivities: TemplateActivityDto[] = activities.map((act: any) => {
        const destName = act.destination?.name || act.customTitle || 'Aktivitas';
        if (destNames.length < 3) {
          destNames.push(destName);
        }

        const categoryObj = act.destination?.category
          ? {
              id: act.destination.category.id,
              name: act.destination.category.name,
              slug: act.destination.category.slug,
            }
          : null;
        const categoryName = act.destination?.category?.name || 'Aktivitas Wisata';
        const imgUrl = act.destination?.coverImageUrl || null;

        const destSummary: DestinationSummaryDto | null = act.destination
          ? {
              id: act.destination.id,
              name: act.destination.name,
              slug: act.destination.slug,
              coverImageUrl: imgUrl,
              imageUrl: imgUrl,
              latitude: act.destination.latitude,
              longitude: act.destination.longitude,
              rating: act.destination.rating,
              category: categoryObj,
              categoryName: categoryName,
            }
          : null;

        const dur = Number(act.travelTimeFromPrevMinutes) || 0;

        return {
          id: act.id,
          templateDayId: act.templateDayId,
          orderIndex: act.orderIndex,
          startTime: act.startTime,
          endTime: act.endTime,
          timeSlot:
            act.startTime && act.endTime ? `${act.startTime} - ${act.endTime}` : act.timeSlot || null,
          activityNotes: act.activityNotes,
          estimatedDurationMinutes: act.estimatedDurationMinutes,
          estimatedCost: Number(act.estimatedCost) || 0,
          distanceFromPrevKm: Number(act.distanceFromPrevKm) || 0,
          travelDurationMinutes: dur,
          travelTimeFromPrevMinutes: dur,
          destinationId: act.destinationId || (act.destination ? act.destination.id : null),
          destinationName: destName,
          destinationCategory: categoryName,
          imageUrl: imgUrl,
          destination: destSummary,
          customLocation: act.customLocation ? this.parseLocation(act.customLocation) : null,
          customTitle: act.customTitle,
        };
      });

      return {
        id: day.id,
        templateId: day.templateId,
        dayNumber: day.dayNumber,
        title: day.title,
        notes: day.notes,
        totalDistanceKm: day.totalDistanceKm,
        totalDurationMinutes: day.totalDurationMinutes,
        totalTravelTimeMinutes: day.totalDurationMinutes,
        estimatedBudget: Number(day.estimatedBudget) || 0,
        activities: mappedActivities,
      };
    });

    const routeSummary = destNames.length > 0 ? destNames.join(' • ') : undefined;

    return {
      id: template.id,
      title: template.title,
      description: template.description,
      coverImageUrl: template.coverImageUrl,
      totalDays: template.totalDays,
      travelStyle: template.travelStyle,
      budgetLevel: template.budgetLevel,
      transportationMode: template.transportationMode,
      transportPaceNote: template.transportPaceNote,
      totalEstimatedBudget: Number(template.totalEstimatedBudget) || 0,
      totalDistanceKm: template.totalDistanceKm,
      totalDurationMinutes: template.totalDurationMinutes,
      totalTravelTimeMinutes: template.totalDurationMinutes,
      destinationCount: totalDestCount,
      totalDestination: totalDestCount,
      todalDestination: totalDestCount,
      totalDestinations: totalDestCount,
      routeSummary,
      isPublished: template.isPublished,
      isFeatured: template.isFeatured,
      sortOrder: template.sortOrder,
      days: mappedDays,
      createdAt: template.createdAt ? (template.createdAt instanceof Date ? template.createdAt.toISOString() : String(template.createdAt)) : new Date().toISOString(),
      updatedAt: template.updatedAt ? (template.updatedAt instanceof Date ? template.updatedAt.toISOString() : String(template.updatedAt)) : new Date().toISOString(),
    };
  }
}

export const itinerariesService = new ItinerariesService();
