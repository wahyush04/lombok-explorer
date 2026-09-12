import * as crypto from 'crypto';
import {
  Accommodation,
  AccommodationImage,
  Category,
  Destination,
  DestinationImage,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  ItineraryItemType,
  Restaurant,
  RestaurantImage,
  TransportationMode,
} from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { itinerariesRepository, ItinerariesRepository } from './itineraries.repository';
import { resolveLocalizedFields } from '../../i18n/content-fallback.util';
import { DEFAULT_LOCALE } from '../../i18n/types';
import {
  AccommodationSummaryDto,
  ActiveTripDayDto,
  ActiveTripResponseDto,
  AddActivityDto,
  AddDayDto,
  ApplyTemplateDto,
  BrowseItineraryQuery,
  BrowseTemplatesResponseDto,
  CreateItineraryDto,
  CustomLocation,
  CustomLocationInput,
  DestinationSummaryDto,
  ItineraryActivityDto,
  ItineraryDayDto,
  ItineraryDto,
  ItineraryQuery,
  ItineraryTemplateDto,
  OptimizeItineraryDto,
  RecommendationsQuery,
  ReorderActivitiesDto,
  RestaurantSummaryDto,
  RouteSegmentDto,
  TemplateActivityDto,
  UpdateActivityDto,
  UpdateDayDto,
  UpdateDayStartDto,
  UpdateItineraryDto,
  UpdateTripStartDto,
} from './dto/itinerary.dto';
import { PaginationMeta } from '../../common/types';
import { mapboxMatrixService, MapboxMatrixService } from './services/mapbox-matrix.service';
import {
  mapboxOptimizationService,
  MapboxOptimizationService,
} from './services/mapbox-optimization.service';
import { GeoCoordinate } from './services/mapbox.types';
import { tripSessionsService } from './trip-sessions.service';

export type ItineraryItemWithDestination = ItineraryItem & {
  destination?: (Destination & { category?: Category | null; images?: DestinationImage[] }) | null;
  restaurant?: (Restaurant & { images?: RestaurantImage[] }) | null;
  accommodation?: (Accommodation & { images?: AccommodationImage[] }) | null;
};

export type ItineraryDayWithItems = ItineraryDay & {
  items: ItineraryItemWithDestination[];
  startTime?: string | null;
};

export type ItineraryWithRelations = Itinerary & {
  days: ItineraryDayWithItems[];
  startTime?: string | null;
};

export class ItinerariesService {
  constructor(
    private readonly repository: ItinerariesRepository = itinerariesRepository,
    private readonly matrixService: MapboxMatrixService = mapboxMatrixService,
    private readonly optimizationService: MapboxOptimizationService = mapboxOptimizationService,
    private readonly sessionService: { reconcileItineraryChange(itineraryId: string): Promise<void> } = tripSessionsService,
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
   * Resolves a location input by extracting coordinates or looking up
   * an existing Destination, Accommodation, or Restaurant by ID.
   */
  public async resolveLocationInput(
    loc?: CustomLocationInput | null,
  ): Promise<CustomLocation | null> {
    if (!loc) return null;

    if (loc.accommodationId) {
      const accom =
        typeof this.repository.findAccommodationById === 'function'
          ? await this.repository.findAccommodationById(loc.accommodationId)
          : await prisma.accommodation.findUnique({ where: { id: loc.accommodationId } });
      if (accom) {
        return {
          name: loc.name || accom.name,
          latitude: loc.latitude !== undefined ? Number(loc.latitude) : accom.latitude,
          longitude: loc.longitude !== undefined ? Number(loc.longitude) : accom.longitude,
          address: loc.address !== undefined ? loc.address : accom.address,
          accommodationId: accom.id,
        };
      }
    }

    if (loc.destinationId) {
      const dest =
        typeof this.repository.findDestinationById === 'function'
          ? await this.repository.findDestinationById(loc.destinationId)
          : await prisma.destination.findUnique({ where: { id: loc.destinationId } });
      if (dest) {
        return {
          name: loc.name || dest.name,
          latitude: loc.latitude !== undefined ? Number(loc.latitude) : dest.latitude,
          longitude: loc.longitude !== undefined ? Number(loc.longitude) : dest.longitude,
          address: loc.address !== undefined ? loc.address : dest.address,
          destinationId: dest.id,
        };
      }
    }

    if (loc.restaurantId) {
      const rest =
        typeof this.repository.findRestaurantById === 'function'
          ? await this.repository.findRestaurantById(loc.restaurantId)
          : await prisma.restaurant.findUnique({ where: { id: loc.restaurantId } });
      if (rest) {
        return {
          name: loc.name || rest.name,
          latitude: loc.latitude !== undefined ? Number(loc.latitude) : rest.latitude,
          longitude: loc.longitude !== undefined ? Number(loc.longitude) : rest.longitude,
          address: loc.address !== undefined ? loc.address : rest.address,
          restaurantId: rest.id,
        };
      }
    }

    if (loc.latitude !== undefined && loc.longitude !== undefined && loc.name) {
      return {
        name: loc.name,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        address: loc.address || null,
        destinationId: loc.destinationId || null,
        accommodationId: loc.accommodationId || null,
        restaurantId: loc.restaurantId || null,
      };
    }

    return null;
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

            let itemType = item.itemType || 'DESTINATION';
            if (itemType === 'DESTINATION' && !item.destinationId) {
              if (item.restaurantId || item.restaurant) itemType = 'RESTAURANT';
              else if (item.accommodationId || item.accommodation) itemType = 'ACCOMMODATION';
              else if (item.customLocation || item.customTitle) itemType = 'CUSTOM';
            }

            const categoryObj = item.destination?.category
              ? {
                  id: item.destination.category.id,
                  name: item.destination.category.name,
                  slug: item.destination.category.slug,
                }
              : null;
            let categoryName = item.destination?.category?.name || 'Aktivitas Wisata';
            let imgUrl = item.destination?.coverImageUrl || null;
            let activityName = item.destination?.name;

            // Collect destination images
            const destImages: string[] = [];
            if (item.destination) {
              if (item.destination.coverImageUrl) destImages.push(item.destination.coverImageUrl);
              if (Array.isArray((item.destination as any).images)) {
                for (const img of (item.destination as any).images) {
                  const url = typeof img === 'string' ? img : img?.imageUrl;
                  if (url && !destImages.includes(url)) destImages.push(url);
                }
              }
            }

            // Collect restaurant images
            const restImages: string[] = [];
            if (item.restaurant) {
              if (item.restaurant.coverImageUrl) restImages.push(item.restaurant.coverImageUrl);
              if (Array.isArray((item.restaurant as any).images)) {
                for (const img of (item.restaurant as any).images) {
                  const url = typeof img === 'string' ? img : img?.imageUrl;
                  if (url && !restImages.includes(url)) restImages.push(url);
                }
              }
            }

            // Collect accommodation images
            const accomImages: string[] = [];
            if (item.accommodation) {
              if (item.accommodation.coverImageUrl) accomImages.push(item.accommodation.coverImageUrl);
              if (Array.isArray((item.accommodation as any).images)) {
                for (const img of (item.accommodation as any).images) {
                  const url = typeof img === 'string' ? img : img?.imageUrl;
                  if (url && !accomImages.includes(url)) accomImages.push(url);
                }
              }
            }

            const destinationSummary: DestinationSummaryDto | null = item.destination
              ? {
                  id: item.destination.id,
                  name: item.destination.name,
                  slug: item.destination.slug,
                  category: categoryObj,
                  categoryName: categoryName,
                  imageUrl: destImages[0] || imgUrl,
                  coverImageUrl: item.destination.coverImageUrl || destImages[0] || imgUrl,
                  images: destImages,
                  rating: item.destination.rating,
                  region: item.destination.region || null,
                  latitude: item.destination.latitude,
                  longitude: item.destination.longitude,
                }
              : null;

            const restaurantSummary: RestaurantSummaryDto | null = item.restaurant
              ? {
                  id: item.restaurant.id,
                  name: item.restaurant.name,
                  slug: item.restaurant.slug,
                  cuisineType: item.restaurant.cuisineType,
                  specialtyDish: item.restaurant.specialtyDish,
                  priceRange: item.restaurant.priceRange,
                  rating: item.restaurant.rating,
                  isHalalCertified: item.restaurant.isHalalCertified,
                  coverImageUrl: item.restaurant.coverImageUrl || restImages[0] || null,
                  imageUrl: restImages[0] || item.restaurant.coverImageUrl || null,
                  images: restImages,
                  address: item.restaurant.address,
                  region: item.restaurant.region,
                  latitude: item.restaurant.latitude,
                  longitude: item.restaurant.longitude,
                }
              : null;

            const accommodationSummary: AccommodationSummaryDto | null = item.accommodation
              ? {
                  id: item.accommodation.id,
                  name: item.accommodation.name,
                  slug: item.accommodation.slug,
                  type: item.accommodation.type,
                  pricePerNight: Number(item.accommodation.pricePerNight),
                  rating: item.accommodation.rating,
                  coverImageUrl: item.accommodation.coverImageUrl || accomImages[0] || null,
                  imageUrl: accomImages[0] || item.accommodation.coverImageUrl || null,
                  images: accomImages,
                  address: item.accommodation.address,
                  region: item.accommodation.region,
                  latitude: item.accommodation.latitude,
                  longitude: item.accommodation.longitude,
                }
              : null;

            let activityImages: string[] = [];

            if (itemType === 'RESTAURANT' && item.restaurant) {
              activityName = item.restaurant.name;
              imgUrl = item.restaurant.coverImageUrl || restImages[0] || imgUrl;
              categoryName = item.restaurant.cuisineType || 'Restoran & Kuliner';
              activityImages = restImages;
            } else if (itemType === 'ACCOMMODATION' && item.accommodation) {
              activityName = item.accommodation.name;
              imgUrl = item.accommodation.coverImageUrl || accomImages[0] || imgUrl;
              categoryName = item.accommodation.type || 'Penginapan';
              activityImages = accomImages;
            } else if (itemType === 'DESTINATION') {
              activityImages = destImages;
            }

            if (activityImages.length === 0 && imgUrl) {
              activityImages = [imgUrl];
            }

            return {
              id: item.id,
              dayId: item.itineraryDayId,
              itemType,
              orderIndex: item.orderIndex,
              timeSlot,
              startTime,
              endTime,
              destinationId: item.destinationId,
              destination: destinationSummary,
              restaurantId: item.restaurantId,
              restaurant: restaurantSummary,
              accommodationId: item.accommodationId,
              accommodation: accommodationSummary,
              destinationName:
                activityName || customLoc?.name || item.customTitle || 'Aktivitas Trip',
              destinationCategory: categoryName,
              imageUrl: imgUrl,
              coverImageUrl: imgUrl,
              images: activityImages,
              customLocation: customLoc,
              customTitle: item.customTitle,
              activityNotes: item.activityNotes,
              notes: item.activityNotes,
              estimatedDurationMinutes: item.estimatedDurationMinutes,
              estimatedCost: cost,
              distanceFromPrevKm: dist,
              travelDurationMinutes: dur,
              travelTimeFromPrevMinutes: dur,
              distanceFromStartKm: idx === 0 ? dist : undefined,
              travelTimeFromStartMinutes: idx === 0 ? dur : undefined,
              isCompleted: Boolean(item.isCompleted),
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            };
          });

          totalDist += dayDist;
          totalDur += dayDur;
          totalBudget += dayBudget;

          // Determine effective day start location
          let dayStartLoc: CustomLocation | null = null;
          let isCustomStartLocation = false;

          const rawDayStartLoc = (day as any).startLocation
            ? this.parseLocation((day as any).startLocation)
            : null;

          if (rawDayStartLoc?.latitude && rawDayStartLoc?.longitude) {
            dayStartLoc = {
              ...rawDayStartLoc,
              isChainedFromPreviousDay: false,
            };
            isCustomStartLocation = true;
          } else if (day.dayNumber === 1) {
            const masterStart = this.parseLocation(itinerary.startLocation);
            dayStartLoc = masterStart
              ? {
                  ...masterStart,
                  isChainedFromPreviousDay: false,
                }
              : null;
          } else {
            // Day > 1: chained from last activity of previous day
            const prevDayRaw = itinerary.days?.find((d) => d.dayNumber === day.dayNumber - 1);
            if (prevDayRaw && Array.isArray(prevDayRaw.items) && prevDayRaw.items.length > 0) {
              const sortedPrevItems = [...prevDayRaw.items].sort((a, b) => b.orderIndex - a.orderIndex);
              const lastItem = sortedPrevItems[0];
              if (lastItem) {
                if (lastItem.destination?.latitude && lastItem.destination?.longitude) {
                  dayStartLoc = {
                    name: lastItem.destination.name,
                    latitude: lastItem.destination.latitude,
                    longitude: lastItem.destination.longitude,
                    address: lastItem.destination.address,
                    destinationId: lastItem.destination.id,
                    isChainedFromPreviousDay: true,
                  };
                } else if (lastItem.accommodation?.latitude && lastItem.accommodation?.longitude) {
                  dayStartLoc = {
                    name: lastItem.accommodation.name,
                    latitude: lastItem.accommodation.latitude,
                    longitude: lastItem.accommodation.longitude,
                    address: lastItem.accommodation.address,
                    accommodationId: lastItem.accommodation.id,
                    isChainedFromPreviousDay: true,
                  };
                } else if (lastItem.restaurant?.latitude && lastItem.restaurant?.longitude) {
                  dayStartLoc = {
                    name: lastItem.restaurant.name,
                    latitude: lastItem.restaurant.latitude,
                    longitude: lastItem.restaurant.longitude,
                    address: lastItem.restaurant.address,
                    restaurantId: lastItem.restaurant.id,
                    isChainedFromPreviousDay: true,
                  };
                } else if (lastItem.customLocation) {
                  const parsed = this.parseLocation(lastItem.customLocation);
                  if (parsed?.latitude && parsed?.longitude) {
                    dayStartLoc = {
                      ...parsed,
                      isChainedFromPreviousDay: true,
                    };
                  }
                }
              }
            }

            if (!dayStartLoc) {
              dayStartLoc = this.parseLocation(itinerary.startLocation);
            }
          }

          const firstActDist = activities.length > 0 ? activities[0]!.distanceFromPrevKm : 0;
          const firstActDur = activities.length > 0 ? activities[0]!.travelDurationMinutes : 0;

          return {
            id: day.id,
            itineraryId: day.itineraryId,
            dayNumber: day.dayNumber,
            title: day.title,
            date: day.date ? (new Date(day.date).toISOString().split('T')[0] ?? null) : null,
            startTime: day.startTime || null,
            startLocation: dayStartLoc,
            isCustomStartLocation,
            distanceFromStartKm: firstActDist,
            travelTimeFromStartMinutes: firstActDur,
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
      totalDestinations: totalDestinationsCount,
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
      startDate: itinerary.startDate
        ? new Date(itinerary.startDate).toISOString()
        : null,
      endDate: itinerary.endDate
        ? new Date(itinerary.endDate).toISOString()
        : null,
      startTime: itinerary.startTime || null,
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

    // 1. Determine origin / starting point for this day
    let startCoord: GeoCoordinate | null = null;

    // Check if day has an explicit custom startLocation
    const dayExplicitStartLoc = (day as any).startLocation
      ? this.parseLocation((day as any).startLocation)
      : null;

    if (dayExplicitStartLoc?.latitude && dayExplicitStartLoc?.longitude) {
      startCoord = {
        id: 'start_location_day',
        name: dayExplicitStartLoc.name || 'Titik Keberangkatan',
        latitude: dayExplicitStartLoc.latitude,
        longitude: dayExplicitStartLoc.longitude,
      };
    } else if (day.dayNumber > 1) {
      // Chaining: use last activity of previous day (Day N-1)
      const prevDay =
        typeof this.repository.findDayByNumber === 'function'
          ? await this.repository.findDayByNumber(day.itineraryId, day.dayNumber - 1)
          : null;
      const lastItem = prevDay?.items?.[0]; // ordered desc by orderIndex
      if (lastItem) {
        if (lastItem.destination?.latitude && lastItem.destination?.longitude) {
          startCoord = {
            id: lastItem.id,
            name: lastItem.destination.name,
            latitude: lastItem.destination.latitude,
            longitude: lastItem.destination.longitude,
          };
        } else if (lastItem.accommodation?.latitude && lastItem.accommodation?.longitude) {
          startCoord = {
            id: lastItem.id,
            name: lastItem.accommodation.name,
            latitude: lastItem.accommodation.latitude,
            longitude: lastItem.accommodation.longitude,
          };
        } else if (lastItem.restaurant?.latitude && lastItem.restaurant?.longitude) {
          startCoord = {
            id: lastItem.id,
            name: lastItem.restaurant.name,
            latitude: lastItem.restaurant.latitude,
            longitude: lastItem.restaurant.longitude,
          };
        } else if (lastItem.customLocation) {
          const parsed = this.parseLocation(lastItem.customLocation);
          if (parsed?.latitude && parsed?.longitude) {
            startCoord = {
              id: lastItem.id,
              name: parsed.name,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
            };
          }
        }
      }

      // Fallback to itinerary startLocation if no previous item coordinate was found
      if (!startCoord) {
        const parsedStartLoc = this.parseLocation(day.itinerary?.startLocation);
        if (parsedStartLoc?.latitude && parsedStartLoc?.longitude) {
          startCoord = {
            id: 'start_location_itin',
            name: parsedStartLoc.name || 'Titik Keberangkatan',
            latitude: parsedStartLoc.latitude,
            longitude: parsedStartLoc.longitude,
          };
        }
      }
    } else if (day.dayNumber === 1) {
      const parsedStartLoc = this.parseLocation(day.itinerary?.startLocation);
      if (parsedStartLoc?.latitude && parsedStartLoc?.longitude) {
        startCoord = {
          id: 'start_location_itin',
          name: parsedStartLoc.name || 'Titik Keberangkatan',
          latitude: parsedStartLoc.latitude,
          longitude: parsedStartLoc.longitude,
        };
      }
    }

    // 2. Collect item coordinates
    const itemCoordinates: (GeoCoordinate | null)[] = [];
    for (const item of items) {
      if (item.destination?.latitude && item.destination?.longitude) {
        itemCoordinates.push({
          id: item.id,
          name: item.destination.name,
          latitude: item.destination.latitude,
          longitude: item.destination.longitude,
        });
      } else if (item.restaurant?.latitude && item.restaurant?.longitude) {
        itemCoordinates.push({
          id: item.id,
          name: item.restaurant.name,
          latitude: item.restaurant.latitude,
          longitude: item.restaurant.longitude,
        });
      } else if (item.accommodation?.latitude && item.accommodation?.longitude) {
        itemCoordinates.push({
          id: item.id,
          name: item.accommodation.name,
          latitude: item.accommodation.latitude,
          longitude: item.accommodation.longitude,
        });
      } else if (item.customLocation) {
        const parsed = this.parseLocation(item.customLocation);
        if (parsed?.latitude && parsed?.longitude) {
          itemCoordinates.push({
            id: item.id,
            name: parsed.name,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          });
        } else {
          itemCoordinates.push(null);
        }
      } else {
        itemCoordinates.push(null);
      }
    }

    // 3. Assemble coordinates for pairwise routing matrix
    const allCoords: GeoCoordinate[] = [];
    let startIdxInMatrix: number | null = null;
    if (startCoord) {
      startIdxInMatrix = allCoords.length;
      allCoords.push(startCoord);
    }

    const itemMatrixIndices: (number | null)[] = [];
    for (const coord of itemCoordinates) {
      if (coord) {
        itemMatrixIndices.push(allCoords.length);
        allCoords.push(coord);
      } else {
        itemMatrixIndices.push(null);
      }
    }

    // 4. Compute matrix if we have coordinates
    const matrix =
      allCoords.length > 1
        ? await this.matrixService.calculateMatrix(allCoords, transportationMode)
        : { distancesKm: [[0]], durationsMinutes: [[0]] };

    const dayStartTime = (day as any)?.startTime as string | null | undefined;
    let currentMinutes =
      (dayStartTime ? this.parseTimeToMinutes(dayStartTime) : null) ??
      this.parseTimeToMinutes(items[0]?.startTime) ??
      8 * 60 + 30; // default 08:30 AM WITA
    let dayDist = 0;
    let dayDur = 0;
    let dayBudget = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const cost = Number(item.estimatedCost) || 0;
      dayBudget += cost;

      let dist = 0;
      let dur = 0;

      const currentIdxInMatrix = itemMatrixIndices[i];

      if (i === 0) {
        // Distance and duration from start location to first activity
        if (startIdxInMatrix !== null && currentIdxInMatrix !== null && currentIdxInMatrix !== undefined) {
          dist = matrix.distancesKm[startIdxInMatrix]?.[currentIdxInMatrix] ?? 0;
          dur = matrix.durationsMinutes[startIdxInMatrix]?.[currentIdxInMatrix] ?? 0;
        }
      } else {
        let prevMatrixIdx: number | null = null;
        for (let p = i - 1; p >= 0; p--) {
          if (itemMatrixIndices[p] !== null && itemMatrixIndices[p] !== undefined) {
            prevMatrixIdx = itemMatrixIndices[p]!;
            break;
          }
        }
        if (prevMatrixIdx === null) {
          prevMatrixIdx = startIdxInMatrix;
        }

        if (prevMatrixIdx !== null && currentIdxInMatrix !== null && currentIdxInMatrix !== undefined) {
          dist = matrix.distancesKm[prevMatrixIdx]?.[currentIdxInMatrix] ?? 0;
          dur = matrix.durationsMinutes[prevMatrixIdx]?.[currentIdxInMatrix] ?? 0;
        }
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

    // Cascade to next day if it exists and has no explicit custom startLocation
    if (typeof this.repository.findDayByNumber === 'function') {
      const nextDay = await this.repository.findDayByNumber(day.itineraryId, day.dayNumber + 1);
      if (nextDay && !(nextDay as any).startLocation) {
        await this.recalculateDayRouteAndSchedule(nextDay.id, transportationMode);
      }
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
      throw new NotFoundError(
        'Shared itinerary not found or expired',
        'SHARED_ITINERARY_NOT_FOUND',
      );
    }
    return this.mapToDto(itinerary as ItineraryWithRelations);
  }

  public async createItinerary(userId: string, dto: CreateItineraryDto): Promise<ItineraryDto> {
    const daysCount = dto.daysCount || dto.totalDays || (dto.days ? dto.days.length : 1);
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    let initialDays: {
      title: string;
      date?: Date | null;
      notes?: string | null;
      items?: unknown[];
    }[] = [];

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
    const resolvedId = await this.resolveActiveItineraryId(id, userId);
    const existing = await this.repository.findById(resolvedId);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${resolvedId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    const startLocationStr =
      dto.startLocation !== undefined
        ? dto.startLocation
          ? JSON.stringify(dto.startLocation)
          : null
        : undefined;

    const endLocationStr =
      dto.endLocation !== undefined
        ? dto.endLocation
          ? JSON.stringify(dto.endLocation)
          : null
        : undefined;

    const startDate =
      dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined;

    await this.repository.updateMasterData(resolvedId, {
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
      startTime: dto.startTime,
      ...(dto.totalEstimatedBudget !== undefined && {
        totalEstimatedBudget: Number(dto.totalEstimatedBudget),
      }),
    });

    if (existing.days.length > 0 && (dto.startTime !== undefined || dto.startLocation !== undefined)) {
      const firstDay = existing.days[0]!;
      if (dto.startTime) {
        await this.repository.updateDay(firstDay.id, { startTime: dto.startTime });
      }
      await this.recalculateDayRouteAndSchedule(firstDay.id, existing.transportationMode || 'CAR');
    }

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteItinerary(userId: string, userRole: string, id: string): Promise<void> {
    const resolvedId = await this.resolveActiveItineraryId(id, userId);
    const existing = await this.repository.findById(resolvedId);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${resolvedId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(resolvedId);
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

  public async generateShareToken(
    userId: string,
    userRole: string,
    id: string,
  ): Promise<{ shareToken: string; shareUrl: string }> {
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
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const itinerary = await this.repository.findById(resolvedId);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${resolvedId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    const date = dto.date ? new Date(dto.date) : null;
    let startLocationStr: string | null = null;
    if (dto.startLocation) {
      const resolved = await this.resolveLocationInput(dto.startLocation);
      startLocationStr = resolved ? JSON.stringify(resolved) : null;
    }

    await this.repository.addDay(resolvedId, {
      title: dto.title,
      date,
      notes: dto.notes,
      startTime: dto.startTime,
      startLocation: startLocationStr,
    });

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async updateDay(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: UpdateDayDto,
  ): Promise<ItineraryDto> {
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== resolvedId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this day',
        'FORBIDDEN_RESOURCE',
      );
    }

    const date = dto.date !== undefined ? (dto.date ? new Date(dto.date) : null) : undefined;
    let startLocationStr: string | null | undefined = undefined;
    if (dto.startLocation !== undefined) {
      if (dto.startLocation === null) {
        startLocationStr = null;
      } else {
        const resolved = await this.resolveLocationInput(dto.startLocation);
        startLocationStr = resolved ? JSON.stringify(resolved) : null;
      }
    }

    await this.repository.updateDay(dayId, {
      title: dto.title,
      date,
      notes: dto.notes,
      startTime: dto.startTime,
      startLocation: startLocationStr,
    });

    if (dto.startTime !== undefined || dto.startLocation !== undefined) {
      await this.recalculateDayRouteAndSchedule(dayId, day.itinerary.transportationMode || 'CAR');
    }

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async updateDayStart(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: UpdateDayStartDto,
  ): Promise<ItineraryDto> {
    return this.updateDay(userId, userRole, itineraryId, dayId, {
      startTime: dto.startTime,
      startLocation: dto.startLocation,
    });
  }

  public async deleteDay(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
  ): Promise<ItineraryDto | { deletedTrip: boolean; message: string; tripId: string }> {
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== resolvedId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this day',
        'FORBIDDEN_RESOURCE',
      );
    }

    const result = await this.repository.deleteDayAndReindex(resolvedId, dayId);

    if (result.itineraryDeleted) {
      await this.sessionService.reconcileItineraryChange(resolvedId);
      return {
        deletedTrip: true,
        tripId: resolvedId,
        message: 'Hari terakhir telah dihapus dari trip plan. Trip plan aktif telah dihapus.',
      };
    }

    await this.sessionService.reconcileItineraryChange(resolvedId);

    const updated = await this.repository.findById(resolvedId);
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
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== resolvedId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to add activities to this trip',
        'FORBIDDEN_RESOURCE',
      );
    }

    // If destinationId provided, validate existence
    if (dto.destinationId) {
      const dest = await prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true, name: true, status: true },
      });
      if (!dest) {
        throw new NotFoundError(
          `Destination '${dto.destinationId}' not found`,
          'DESTINATION_NOT_FOUND',
        );
      }
    }

    // If restaurantId provided, validate existence
    if (dto.restaurantId) {
      const rest = await prisma.restaurant.findUnique({
        where: { id: dto.restaurantId },
        select: { id: true, name: true, status: true },
      });
      if (!rest) {
        throw new NotFoundError(
          `Restaurant '${dto.restaurantId}' not found`,
          'RESTAURANT_NOT_FOUND',
        );
      }
    }

    // If accommodationId provided, validate existence
    if (dto.accommodationId) {
      const accom = await prisma.accommodation.findUnique({
        where: { id: dto.accommodationId },
        select: { id: true, name: true, status: true },
      });
      if (!accom) {
        throw new NotFoundError(
          `Accommodation '${dto.accommodationId}' not found`,
          'ACCOMMODATION_NOT_FOUND',
        );
      }
    }

    let inferredType: ItineraryItemType = dto.itemType || 'DESTINATION';
    if (!dto.itemType || (dto.itemType === 'DESTINATION' && !dto.destinationId)) {
      if (dto.restaurantId) inferredType = 'RESTAURANT';
      else if (dto.accommodationId) inferredType = 'ACCOMMODATION';
      else if (dto.destinationId) inferredType = 'DESTINATION';
      else if (dto.customLocation || dto.customTitle) inferredType = 'CUSTOM';
    }

    const customLocationStr = dto.customLocation ? JSON.stringify(dto.customLocation) : null;

    await this.repository.addActivity(dayId, {
      itemType: inferredType,
      destinationId: dto.destinationId,
      restaurantId: dto.restaurantId,
      accommodationId: dto.accommodationId,
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
    await this.sessionService.reconcileItineraryChange(resolvedId);

    const updated = await this.repository.findById(resolvedId);
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
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const activity = await this.repository.findActivityById(activityId);
    if (
      !activity ||
      activity.itineraryDayId !== dayId ||
      activity.itineraryDay.itineraryId !== resolvedId
    ) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in specified day`,
        'ACTIVITY_NOT_FOUND',
      );
    }

    if (activity.itineraryDay.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this activity',
        'FORBIDDEN_RESOURCE',
      );
    }

    if (dto.destinationId) {
      const dest = await prisma.destination.findUnique({
        where: { id: dto.destinationId },
        select: { id: true },
      });
      if (!dest) {
        throw new NotFoundError(
          `Destination '${dto.destinationId}' not found`,
          'DESTINATION_NOT_FOUND',
        );
      }
    }

    if (dto.restaurantId) {
      const rest = await prisma.restaurant.findUnique({
        where: { id: dto.restaurantId },
        select: { id: true },
      });
      if (!rest) {
        throw new NotFoundError(
          `Restaurant '${dto.restaurantId}' not found`,
          'RESTAURANT_NOT_FOUND',
        );
      }
    }

    if (dto.accommodationId) {
      const accom = await prisma.accommodation.findUnique({
        where: { id: dto.accommodationId },
        select: { id: true },
      });
      if (!accom) {
        throw new NotFoundError(
          `Accommodation '${dto.accommodationId}' not found`,
          'ACCOMMODATION_NOT_FOUND',
        );
      }
    }

    let inferredType = dto.itemType;
    if (!inferredType || (inferredType === 'DESTINATION' && !dto.destinationId)) {
      if (dto.restaurantId) inferredType = 'RESTAURANT';
      else if (dto.accommodationId) inferredType = 'ACCOMMODATION';
      else if (dto.destinationId) inferredType = 'DESTINATION';
      else if (dto.customLocation || dto.customTitle) inferredType = 'CUSTOM';
    }

    const customLocationStr =
      dto.customLocation !== undefined
        ? dto.customLocation
          ? JSON.stringify(dto.customLocation)
          : null
        : undefined;

    await this.repository.updateActivity(activityId, {
      itemType: inferredType,
      destinationId: dto.destinationId,
      restaurantId: dto.restaurantId,
      accommodationId: dto.accommodationId,
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

    await this.recalculateDayRouteAndSchedule(
      dayId,
      activity.itineraryDay.itinerary.transportationMode,
    );
    await this.sessionService.reconcileItineraryChange(resolvedId);

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteActivity(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    activityId: string,
  ): Promise<ItineraryDto> {
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const activity = await this.repository.findActivityById(activityId);
    if (
      !activity ||
      activity.itineraryDayId !== dayId ||
      activity.itineraryDay.itineraryId !== resolvedId
    ) {
      throw new NotFoundError(
        `Activity '${activityId}' not found in specified day`,
        'ACTIVITY_NOT_FOUND',
      );
    }

    if (activity.itineraryDay.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this activity',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.deleteActivityAndReindex(dayId, activityId);
    await this.recalculateDayRouteAndSchedule(
      dayId,
      activity.itineraryDay.itinerary.transportationMode,
    );
    await this.sessionService.reconcileItineraryChange(resolvedId);

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async reorderActivities(
    userId: string,
    userRole: string,
    itineraryId: string,
    dayId: string,
    dto: ReorderActivitiesDto,
  ): Promise<ItineraryDto> {
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const day = await this.repository.findDayById(dayId);
    if (!day || day.itineraryId !== resolvedId) {
      throw new NotFoundError(`Day '${dayId}' not found in itinerary`, 'DAY_NOT_FOUND');
    }

    if (day.itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to reorder activities in this trip',
        'FORBIDDEN_RESOURCE',
      );
    }

    const dayItemIds = new Set(day.items.map((it) => it.id));
    for (const item of dto.activities) {
      if (!dayItemIds.has(item.id)) {
        throw new ValidationError(`Activity '${item.id}' does not belong to Day '${dayId}'`);
      }
    }

    await this.repository.reorderActivities(dayId, dto.activities);
    await this.recalculateDayRouteAndSchedule(dayId, day.itinerary.transportationMode);
    await this.sessionService.reconcileItineraryChange(resolvedId);

    const updated = await this.repository.findById(resolvedId);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  // --- ROUTE OPTIMIZATION ---
  public async optimizeRoute(
    userId: string,
    userRole: string,
    itineraryId: string,
    dto: OptimizeItineraryDto,
  ): Promise<ItineraryDto> {
    const resolvedId = await this.resolveActiveItineraryId(itineraryId, userId);
    const itinerary = await this.repository.findById(resolvedId);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${resolvedId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to optimize this trip',
        'FORBIDDEN_RESOURCE',
      );
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

    await this.sessionService.reconcileItineraryChange(resolvedId);

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
        days: [],
      };
    }

    const itinerary = await this.repository.findActiveTripByUserId(userId);
    if (!itinerary) {
      return {
        hasActiveTrip: false,
        trip: null,
        days: [],
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

    const mappedDays: ActiveTripDayDto[] = days.map((day) => {
      const items = Array.isArray(day.items) ? day.items : [];
      const dayDist = Number(day.totalDistanceKm) || 0;
      const dayDur = Number(day.totalTravelTimeMinutes) || 0;
      return {
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title || `Hari ${day.dayNumber}`,
        date: day.date ? (new Date(day.date).toISOString().split('T')[0] || null) : null,
        startTime: ((day as any).startTime as string | null) || null,
        activityCount: items.length,
        activitiesCount: items.length,
        totalDistanceKm: Math.round(dayDist * 10) / 10,
        totalDurationMinutes: Math.round(dayDur),
        totalTravelTimeMinutes: Math.round(dayDur),
      };
    });

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
        currentDayId: activeDay?.id || null,
        badgeText,
        totalDistanceKm: totalDistKm,
        distanceFormatted,
        totalDestinations: totalActivitiesCount,
        focus: {
          dayId: activeDay?.id || null,
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
        days: mappedDays,
        shareToken,
        shareUrl,
        startDate: itinerary.startDate ? itinerary.startDate.toISOString() : null,
        endDate: itinerary.endDate ? itinerary.endDate.toISOString() : null,
        startTime: ((itinerary as any).startTime as string | null) || null,
        startLocation: this.parseLocation(itinerary.startLocation),
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString(),
      },
      days: mappedDays,
    };
  }

  /**
   * Helper to resolve 'active' or 'active-trip' keyword into the user's active itinerary ID.
   */
  public async resolveActiveItineraryId(idOrActive: string, userId: string): Promise<string> {
    if (idOrActive === 'active' || idOrActive === 'active-trip') {
      const activeTrip = await this.repository.findActiveTripByUserId(userId);
      if (!activeTrip) {
        throw new NotFoundError('Tidak ada trip plan aktif yang ditemukan', 'NO_ACTIVE_TRIP');
      }
      return activeTrip.id;
    }
    return idOrActive;
  }

  /**
   * Deletes the user's current active trip plan.
   */
  public async deleteActiveTrip(userId: string): Promise<{ id: string; deleted: boolean }> {
    const activeTrip = await this.repository.findActiveTripByUserId(userId);
    if (!activeTrip) {
      throw new NotFoundError('Tidak ada trip plan aktif yang ditemukan', 'NO_ACTIVE_TRIP');
    }
    await this.repository.delete(activeTrip.id);
    return { id: activeTrip.id, deleted: true };
  }

  /**
   * Updates start location and/or start time/date for the user's active trip plan.
   */
  public async updateActiveTripStart(
    userId: string,
    dto: UpdateTripStartDto,
  ): Promise<ItineraryDto> {
    const activeTrip = await this.repository.findActiveTripByUserId(userId);
    if (!activeTrip) {
      throw new NotFoundError('Tidak ada trip plan aktif yang ditemukan', 'NO_ACTIVE_TRIP');
    }

    const startLocationStr =
      dto.startLocation !== undefined
        ? dto.startLocation
          ? JSON.stringify(dto.startLocation)
          : null
        : undefined;

    const startDate =
      dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined;

    await this.repository.updateMasterData(activeTrip.id, {
      startLocation: startLocationStr,
      startDate,
      startTime: dto.startTime,
    });

    if (activeTrip.days.length > 0 && (dto.startTime !== undefined || dto.startLocation !== undefined)) {
      const firstDay = activeTrip.days[0]!;
      if (dto.startTime) {
        await this.repository.updateDay(firstDay.id, { startTime: dto.startTime });
      }
      await this.recalculateDayRouteAndSchedule(firstDay.id, activeTrip.transportationMode || 'CAR');
    }

    const updated = await this.repository.findById(activeTrip.id);
    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async getRecommendations(
    query: RecommendationsQuery,
    locale: string = DEFAULT_LOCALE,
  ): Promise<ItineraryTemplateDto[]> {
    const templates = await this.repository.findRecommendations(query);
    return templates.map((t: any) => this.mapTemplateToDto(t, locale));
  }

  public async browseTemplates(
    query: BrowseItineraryQuery,
    locale: string = DEFAULT_LOCALE,
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
      page > totalPages && total > 0 ? [] : items.map((t: any) => this.mapTemplateToDto(t, locale));

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

  public async getTemplateById(
    id: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<ItineraryTemplateDto> {
    const template = await this.repository.findTemplateById(id);
    if (!template || !template.isPublished) {
      throw new NotFoundError(
        `Curated itinerary template with ID '${id}' not found`,
        'TEMPLATE_NOT_FOUND',
      );
    }
    return this.mapTemplateToDto(template, locale);
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

  private mapTemplateToDto(template: any, locale: string = DEFAULT_LOCALE): ItineraryTemplateDto {
    const days = template.days || [];
    let totalDestCount = 0;
    const destNames: string[] = [];

    const localized = resolveLocalizedFields(
      locale,
      template.translations,
      template,
      ['title', 'description', 'transportPaceNote'],
    );

    const mappedDays = days.map((day: any) => {
      const activities = day.activities || [];
      totalDestCount += activities.length;

      const mappedActivities: TemplateActivityDto[] = activities.map((act: any) => {
        let itemType = act.itemType || 'DESTINATION';
        if (itemType === 'DESTINATION' && !act.destinationId) {
          if (act.restaurantId || act.restaurant) itemType = 'RESTAURANT';
          else if (act.accommodationId || act.accommodation) itemType = 'ACCOMMODATION';
          else if (act.customLocation || act.customTitle) itemType = 'CUSTOM';
        }

        let destName = act.destination?.name || act.customTitle || 'Aktivitas';
        let categoryName = act.destination?.category?.name || 'Aktivitas Wisata';
        let imgUrl = act.destination?.coverImageUrl || null;

        const categoryObj = act.destination?.category
          ? {
              id: act.destination.category.id,
              name: act.destination.category.name,
              slug: act.destination.category.slug,
            }
          : null;

        // Collect destination images
        const destImages: string[] = [];
        if (act.destination) {
          if (act.destination.coverImageUrl) destImages.push(act.destination.coverImageUrl);
          if (Array.isArray(act.destination.images)) {
            for (const img of act.destination.images) {
              const url = typeof img === 'string' ? img : img?.imageUrl;
              if (url && !destImages.includes(url)) destImages.push(url);
            }
          }
        }

        // Collect restaurant images
        const restImages: string[] = [];
        if (act.restaurant) {
          if (act.restaurant.coverImageUrl) restImages.push(act.restaurant.coverImageUrl);
          if (Array.isArray(act.restaurant.images)) {
            for (const img of act.restaurant.images) {
              const url = typeof img === 'string' ? img : img?.imageUrl;
              if (url && !restImages.includes(url)) restImages.push(url);
            }
          }
        }

        // Collect accommodation images
        const accomImages: string[] = [];
        if (act.accommodation) {
          if (act.accommodation.coverImageUrl) accomImages.push(act.accommodation.coverImageUrl);
          if (Array.isArray(act.accommodation.images)) {
            for (const img of act.accommodation.images) {
              const url = typeof img === 'string' ? img : img?.imageUrl;
              if (url && !accomImages.includes(url)) accomImages.push(url);
            }
          }
        }

        const destSummary: DestinationSummaryDto | null = act.destination
          ? {
              id: act.destination.id,
              name: act.destination.name,
              slug: act.destination.slug,
              coverImageUrl: act.destination.coverImageUrl || destImages[0] || imgUrl,
              imageUrl: destImages[0] || imgUrl,
              images: destImages,
              latitude: act.destination.latitude,
              longitude: act.destination.longitude,
              rating: act.destination.rating,
              category: categoryObj,
              categoryName: categoryName,
            }
          : null;

        const restaurantSummary: RestaurantSummaryDto | null = act.restaurant
          ? {
              id: act.restaurant.id,
              name: act.restaurant.name,
              slug: act.restaurant.slug,
              cuisineType: act.restaurant.cuisineType,
              specialtyDish: act.restaurant.specialtyDish,
              priceRange: act.restaurant.priceRange,
              rating: act.restaurant.rating,
              isHalalCertified: act.restaurant.isHalalCertified,
              coverImageUrl: act.restaurant.coverImageUrl || restImages[0] || null,
              imageUrl: restImages[0] || act.restaurant.coverImageUrl || null,
              images: restImages,
              address: act.restaurant.address,
              region: act.restaurant.region,
              latitude: act.restaurant.latitude,
              longitude: act.restaurant.longitude,
            }
          : null;

        const accommodationSummary: AccommodationSummaryDto | null = act.accommodation
          ? {
              id: act.accommodation.id,
              name: act.accommodation.name,
              slug: act.accommodation.slug,
              type: act.accommodation.type,
              pricePerNight: Number(act.accommodation.pricePerNight),
              rating: act.accommodation.rating,
              coverImageUrl: act.accommodation.coverImageUrl || accomImages[0] || null,
              imageUrl: accomImages[0] || act.accommodation.coverImageUrl || null,
              images: accomImages,
              address: act.accommodation.address,
              region: act.accommodation.region,
              latitude: act.accommodation.latitude,
              longitude: act.accommodation.longitude,
            }
          : null;

        let activityImages: string[] = [];

        if (itemType === 'RESTAURANT' && act.restaurant) {
          destName = act.restaurant.name;
          imgUrl = act.restaurant.coverImageUrl || restImages[0] || imgUrl;
          categoryName = act.restaurant.cuisineType || 'Restoran & Kuliner';
          activityImages = restImages;
        } else if (itemType === 'ACCOMMODATION' && act.accommodation) {
          destName = act.accommodation.name;
          imgUrl = act.accommodation.coverImageUrl || accomImages[0] || imgUrl;
          categoryName = act.accommodation.type || 'Penginapan';
          activityImages = accomImages;
        } else if (itemType === 'DESTINATION') {
          activityImages = destImages;
        }

        if (activityImages.length === 0 && imgUrl) {
          activityImages = [imgUrl];
        }

        if (destNames.length < 3) {
          destNames.push(destName);
        }

        const dur = Number(act.travelTimeFromPrevMinutes) || 0;

        return {
          id: act.id,
          templateDayId: act.templateDayId,
          itemType,
          orderIndex: act.orderIndex,
          startTime: act.startTime,
          endTime: act.endTime,
          timeSlot:
            act.startTime && act.endTime
              ? `${act.startTime} - ${act.endTime}`
              : act.timeSlot || null,
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
          coverImageUrl: imgUrl,
          images: activityImages,
          destination: destSummary,
          restaurantId: act.restaurantId || (act.restaurant ? act.restaurant.id : null),
          restaurant: restaurantSummary,
          accommodationId: act.accommodationId || (act.accommodation ? act.accommodation.id : null),
          accommodation: accommodationSummary,
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
      title: localized.title,
      description: localized.description,
      coverImageUrl: template.coverImageUrl,
      totalDays: template.totalDays,
      travelStyle: template.travelStyle,
      budgetLevel: template.budgetLevel,
      transportationMode: template.transportationMode,
      transportPaceNote: localized.transportPaceNote,
      totalEstimatedBudget: Number(template.totalEstimatedBudget) || 0,
      totalDistanceKm: template.totalDistanceKm,
      totalDurationMinutes: template.totalDurationMinutes,
      totalTravelTimeMinutes: template.totalDurationMinutes,
      totalDestinations: totalDestCount,
      routeSummary,
      isPublished: template.isPublished,
      isFeatured: template.isFeatured,
      sortOrder: template.sortOrder,
      days: mappedDays,
      createdAt: template.createdAt
        ? template.createdAt instanceof Date
          ? template.createdAt.toISOString()
          : String(template.createdAt)
        : new Date().toISOString(),
      updatedAt: template.updatedAt
        ? template.updatedAt instanceof Date
          ? template.updatedAt.toISOString()
          : String(template.updatedAt)
        : new Date().toISOString(),
    };
  }
}

export const itinerariesService = new ItinerariesService();
