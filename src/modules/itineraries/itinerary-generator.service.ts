import { BudgetLevel, Category, Destination, LombokRegion, TravelStyle } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  GenerateItineraryDto,
  GeneratedItineraryResponse,
  TransportationType,
  TravelPace,
} from './dto/itinerary-generator.dto';
import {
  ItineraryActivityDto,
  ItineraryDayDto,
  ItineraryDto,
} from './dto/itinerary.dto';
import { itinerariesRepository, ItinerariesRepository } from './itineraries.repository';

interface GeoPoint {
  name: string;
  latitude: number;
  longitude: number;
}

interface DestinationCandidate {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  region: LombokRegion;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  entranceFee: number;
  estimatedDurationMinutes: number;
  openingHours: string;
  tags: string[];
  coverImageUrl: string;
  isFeatured: boolean;
  score: number;
}

type DestinationWithCategory = Destination & { category: Category };

export class ItineraryGeneratorService {
  constructor(private readonly repository: ItinerariesRepository = itinerariesRepository) {}

  // Known anchor points in Lombok
  private readonly ANCHOR_POINTS: Record<string, GeoPoint> = {
    AIRPORT: { name: 'Bandara Internasional Lombok (LOP)', latitude: -8.7617, longitude: 116.2758 },
    MATARAM: { name: 'Kota Mataram', latitude: -8.5833, longitude: 116.1167 },
    SENGGIGI: { name: 'Kawasan Wisata Senggigi', latitude: -8.5061, longitude: 116.0505 },
    KUTA: { name: 'Kuta Mandalika Beach Area', latitude: -8.892, longitude: 116.295 },
    BANGSAL: {
      name: 'Pelabuhan Bangsal (Penyeberangan Gili)',
      latitude: -8.397,
      longitude: 116.108,
    },
    SEMBALUN: { name: 'Kawasan Lembah Sembalun Rinjani', latitude: -8.3589, longitude: 116.527 },
  };

  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  public getAverageSpeedKmH(transportation: TransportationType): number {
    switch (transportation) {
      case 'MOTORCYCLE':
        return 40;
      case 'WALKING':
        return 5;
      case 'PUBLIC_BOAT':
        return 20;
      case 'CAR':
      default:
        return 45;
    }
  }

  public estimateTransitMinutes(distanceKm: number, transportation: TransportationType): number {
    const speed = this.getAverageSpeedKmH(transportation);
    const travelMinutes = (distanceKm / speed) * 60;
    const bufferMinutes = transportation === 'WALKING' ? 5 : 15;
    return Math.max(10, Math.round(travelMinutes + bufferMinutes));
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map((num) => parseInt(num, 10));
    return (hours ?? 8) * 60 + (minutes ?? 0);
  }

  private formatTime(minutesFromMidnight: number): string {
    const hours = Math.floor(minutesFromMidnight / 60) % 24;
    const mins = minutesFromMidnight % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private parseJsonArray(jsonStr: string | null | undefined): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return jsonStr ? [jsonStr] : [];
    }
  }

  private resolveStartLocation(startLocation: GenerateItineraryDto['startLocation']): GeoPoint {
    const defaultAirport: GeoPoint = {
      name: 'Bandara Internasional Lombok (LOP)',
      latitude: -8.7617,
      longitude: 116.2758,
    };

    if (typeof startLocation === 'object' && startLocation !== null) {
      const lat = 'latitude' in startLocation ? Number(startLocation.latitude) : NaN;
      const lng = 'longitude' in startLocation ? Number(startLocation.longitude) : NaN;
      const name =
        'name' in startLocation && typeof startLocation.name === 'string'
          ? startLocation.name
          : 'Custom Starting Point';

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { name, latitude: lat, longitude: lng };
      }
    }

    if (typeof startLocation === 'string') {
      const lower = startLocation.toLowerCase();
      if (lower.includes('mataram') || lower.includes('ampenan'))
        return this.ANCHOR_POINTS.MATARAM ?? defaultAirport;
      if (lower.includes('senggigi')) return this.ANCHOR_POINTS.SENGGIGI ?? defaultAirport;
      if (lower.includes('kuta') || lower.includes('mandalika'))
        return this.ANCHOR_POINTS.KUTA ?? defaultAirport;
      if (lower.includes('bangsal') || lower.includes('gili'))
        return this.ANCHOR_POINTS.BANGSAL ?? defaultAirport;
      if (lower.includes('sembalun') || lower.includes('rinjani'))
        return this.ANCHOR_POINTS.SEMBALUN ?? defaultAirport;
    }

    return this.ANCHOR_POINTS.AIRPORT ?? defaultAirport;
  }

  private calculateDaysCount(startDateStr: string, endDateStr: string): number {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(Math.max(diffDays, 1), 14); // Clamp between 1 and 14 days
  }

  private scoreDestination(
    dest: DestinationWithCategory,
    travelStyle: TravelStyle,
    interests: string[],
  ): number {
    let score = dest.rating * 10 + Math.log10(dest.reviewCount + 1) * 5;
    if (dest.isFeatured) score += 15;

    const tags = this.parseJsonArray(dest.tags).map((t) => t.toLowerCase());
    const catSlug = dest.category.slug.toLowerCase();

    // Style match
    if (
      travelStyle === TravelStyle.BEACH_RELAXATION &&
      (catSlug === 'beach' ||
        catSlug === 'gili' ||
        catSlug === 'snorkeling' ||
        catSlug === 'surfing')
    ) {
      score += 25;
    } else if (
      travelStyle === TravelStyle.NATURE_ADVENTURE &&
      (catSlug === 'waterfall' ||
        catSlug === 'mountain' ||
        catSlug === 'hill' ||
        catSlug === 'adventure')
    ) {
      score += 25;
    } else if (
      travelStyle === TravelStyle.CULTURE_HERITAGE &&
      (catSlug === 'culture' || catSlug === 'village')
    ) {
      score += 25;
    } else if (travelStyle === TravelStyle.CULINARY_EXPLORER && catSlug === 'culinary') {
      score += 30;
    } else if (
      travelStyle === TravelStyle.PHOTOGRAPHY_SPOTS &&
      (catSlug === 'sunset' || catSlug === 'hill' || catSlug === 'waterfall')
    ) {
      score += 25;
    }

    // Interests match
    for (const interest of interests) {
      const lower = interest.toLowerCase().trim();
      if (catSlug.includes(lower)) score += 15;
      if (tags.some((t) => t.includes(lower))) score += 15;
    }

    return score;
  }

  public async generateItinerary(
    dto: GenerateItineraryDto,
    userId?: string,
  ): Promise<GeneratedItineraryResponse> {
    const totalDays = this.calculateDaysCount(dto.startDate, dto.endDate);
    const travelers = Number(dto.travelers || dto.numberOfTravelers || 1);
    const startPoint = this.resolveStartLocation(dto.startLocation);
    const pace: TravelPace = dto.travelPace || 'BALANCED';
    const transportation: TransportationType = dto.transportation || 'CAR';
    const style: TravelStyle = dto.travelStyle || TravelStyle.BEACH_RELAXATION;
    const interestsList = dto.interests || [];

    // 1. Fetch eligible destinations with selected required fields (avoid over-fetching)
    const allDestinations = await prisma.destination.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        region: true,
        latitude: true,
        longitude: true,
        rating: true,
        reviewCount: true,
        entranceFee: true,
        estimatedDurationMinutes: true,
        openingHours: true,
        tags: true,
        coverImageUrl: true,
        isFeatured: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // 2. Score and convert to candidate objects
    const scoredCandidates: DestinationCandidate[] = (
      allDestinations as DestinationWithCategory[]
    ).map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      categoryName: d.category.name,
      categorySlug: d.category.slug,
      region: d.region,
      latitude: d.latitude,
      longitude: d.longitude,
      rating: d.rating,
      reviewCount: d.reviewCount,
      entranceFee: Number(d.entranceFee) || 0,
      estimatedDurationMinutes: d.estimatedDurationMinutes || 60,
      openingHours: d.openingHours,
      tags: this.parseJsonArray(d.tags),
      coverImageUrl: d.coverImageUrl,
      isFeatured: d.isFeatured,
      score: this.scoreDestination(d, style, interestsList),
    }));

    // Sort by overall score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 3. Cluster Partition Strategy by Day
    const regionClusters: LombokRegion[][] = [
      [LombokRegion.LOMBOK_SELATAN, LombokRegion.LOMBOK_TENGAH], // Cluster Mandalika & Culture
      [LombokRegion.GILI_ISLANDS, LombokRegion.LOMBOK_BARAT], // Cluster Gili & Senggigi
      [LombokRegion.LOMBOK_UTARA, LombokRegion.LOMBOK_TIMUR], // Cluster Rinjani & Waterfalls
      [LombokRegion.LOMBOK_SELATAN, LombokRegion.LOMBOK_BARAT], // Cluster Sekotong & Beaches
    ];

    const visitedDestinationIds = new Set<string>();
    const generatedDays: ItineraryDayDto[] = [];
    let totalItineraryCost = 0;
    let totalStopsCount = 0;

    const startMinutesDaily = this.parseTime(dto.startTime || '08:30');
    const endMinutesDaily = this.parseTime(dto.endTime || '19:00');

    // Max activities per day based on pace
    const maxActivitiesPerDay = pace === 'RELAXED' ? 2 : pace === 'INTENSE' ? 4 : 3;

    // 4. Generate schedule for each day
    const startDateObj = new Date(dto.startDate);

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const currentDayNumber = dayIndex + 1;
      const currentDayDate = new Date(startDateObj);
      currentDayDate.setDate(startDateObj.getDate() + dayIndex);
      const dateStr = currentDayDate.toISOString().split('T')[0] ?? null;

      const clusterRegions = regionClusters[dayIndex % regionClusters.length] || [
        LombokRegion.LOMBOK_SELATAN,
      ];

      // Filter available candidates for this day's region cluster
      let dayCandidates = scoredCandidates.filter(
        (c) => clusterRegions.includes(c.region) && !visitedDestinationIds.has(c.id),
      );

      // Fallback if specific cluster is exhausted
      if (dayCandidates.length < 2) {
        dayCandidates = scoredCandidates.filter((c) => !visitedDestinationIds.has(c.id));
      }

      let currentLat = startPoint.latitude;
      let currentLng = startPoint.longitude;
      let currentMinutes = startMinutesDaily;
      let lunchInserted = false;
      let orderIndex = 1;

      const dayActivities: ItineraryActivityDto[] = [];

      while (
        currentMinutes < endMinutesDaily &&
        dayActivities.length < maxActivitiesPerDay &&
        dayCandidates.length > 0
      ) {
        // Automatically insert lunch around 12:00 - 13:30
        if (!lunchInserted && currentMinutes >= 720 && currentMinutes <= 810) {
          const lunchDuration = 60;
          const lunchCost = 35000 * travelers;
          const lunchStart = this.formatTime(currentMinutes);
          currentMinutes += lunchDuration;
          const lunchEnd = this.formatTime(currentMinutes);

          dayActivities.push({
            id: `act_gen_lunch_d${currentDayNumber}`,
            dayId: `day_gen_${currentDayNumber}`,
            orderIndex: orderIndex++,
            timeSlot: `${lunchStart} - ${lunchEnd}`,
            startTime: lunchStart,
            endTime: lunchEnd,
            destinationId: null,
            destination: null,
            destinationName: 'Istirahat & Makan Siang Kuliner Khas Lombok',
            destinationCategory: 'Kuliner & Relaksasi',
            imageUrl: undefined,
            customLocation: null,
            customTitle: 'Makan Siang Kuliner Khas Lombok (Ayam Taliwang / Nasi Balap)',
            activityNotes: 'Menikmati sajian otentik khas Lombok di resto/warung terdekat.',
            notes: 'Menikmati sajian otentik khas Lombok di resto/warung terdekat.',
            estimatedDurationMinutes: lunchDuration,
            estimatedCost: lunchCost,
            distanceFromPrevKm: 0,
            travelTimeFromPrevMinutes: 0,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          totalItineraryCost += lunchCost;
          lunchInserted = true;
          continue;
        }

        // Find best next destination via Nearest-Neighbor heuristic
        let bestCandidateIndex = 0;
        let bestCandidateScore = -Infinity;

        for (let i = 0; i < Math.min(dayCandidates.length, 10); i++) {
          const cand = dayCandidates[i];
          if (!cand) continue;
          const distKm = this.calculateDistanceKm(
            currentLat,
            currentLng,
            cand.latitude,
            cand.longitude,
          );
          const transitMins = this.estimateTransitMinutes(distKm, transportation);

          // Proximity-adjusted score
          const proximityScore = cand.score - distKm * 1.2 - transitMins * 0.3;
          if (proximityScore > bestCandidateScore) {
            bestCandidateScore = proximityScore;
            bestCandidateIndex = i;
          }
        }

        const chosen = dayCandidates[bestCandidateIndex];
        if (!chosen) break;

        dayCandidates.splice(bestCandidateIndex, 1);
        visitedDestinationIds.add(chosen.id);

        const distKm = this.calculateDistanceKm(
          currentLat,
          currentLng,
          chosen.latitude,
          chosen.longitude,
        );
        const transitMins = this.estimateTransitMinutes(distKm, transportation);

        // Add transit time
        currentMinutes += transitMins;
        if (currentMinutes >= endMinutesDaily) break;

        const visitDuration =
          pace === 'RELAXED'
            ? Math.round(chosen.estimatedDurationMinutes * 1.2)
            : pace === 'INTENSE'
              ? Math.round(chosen.estimatedDurationMinutes * 0.85)
              : chosen.estimatedDurationMinutes;

        const startTimeStr = this.formatTime(currentMinutes);
        currentMinutes += visitDuration;
        const endTimeStr = this.formatTime(currentMinutes);

        const stopCost = chosen.entranceFee * travelers;
        totalItineraryCost += stopCost;
        totalStopsCount++;

        dayActivities.push({
          id: `act_gen_${chosen.id}_d${currentDayNumber}`,
          dayId: `day_gen_${currentDayNumber}`,
          orderIndex: orderIndex++,
          timeSlot: `${startTimeStr} - ${endTimeStr}`,
          startTime: startTimeStr,
          endTime: endTimeStr,
          destinationId: chosen.id,
          destination: {
            id: chosen.id,
            name: chosen.name,
            slug: chosen.slug,
            coverImageUrl: chosen.coverImageUrl,
            rating: chosen.rating,
            region: chosen.region,
            latitude: chosen.latitude,
            longitude: chosen.longitude,
          },
          destinationName: chosen.name,
          destinationCategory: chosen.categoryName,
          imageUrl: chosen.coverImageUrl,
          customLocation: null,
          customTitle: null,
          activityNotes: `Kunjungi ${chosen.name}. ${chosen.tags.length > 0 ? 'Highlight: ' + chosen.tags.slice(0, 3).join(', ') : ''}`,
          notes: `Kunjungi ${chosen.name}.`,
          estimatedDurationMinutes: visitDuration,
          estimatedCost: stopCost,
          distanceFromPrevKm: distKm,
          travelTimeFromPrevMinutes: transitMins,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        currentLat = chosen.latitude;
        currentLng = chosen.longitude;
      }

      // Day Title & Summary
      const regionNames = clusterRegions
        .map((r) => r.replace('LOMBOK_', '').replace('_', ' '))
        .join(' & ');
      const dayTitle = `Hari ${currentDayNumber}: Eksplorasi ${regionNames}`;

      let dayDist = 0;
      let dayDur = 0;
      let dayBudget = 0;
      for (const act of dayActivities) {
        dayDist += act.distanceFromPrevKm;
        dayDur += act.travelTimeFromPrevMinutes;
        dayBudget += act.estimatedCost;
      }

      generatedDays.push({
        id: `day_gen_${currentDayNumber}`,
        itineraryId: `itin_generated_${Date.now()}`,
        dayNumber: currentDayNumber,
        title: dayTitle,
        date: dateStr,
        notes: `Rute optimal hari ke-${currentDayNumber} di kawasan ${regionNames}.`,
        totalDistanceKm: Math.round(dayDist * 10) / 10,
        totalTravelTimeMinutes: Math.round(dayDur),
        estimatedBudget: dayBudget,
        segments: [],
        activities: dayActivities,
        items: dayActivities,
      });
    }

    const defaultTitle =
      dto.title || `${totalDays} Hari Liburan Seru di Lombok (${style.replace('_', ' ')})`;

    let totalDistAll = 0;
    let totalDurAll = 0;
    for (const d of generatedDays) {
      totalDistAll += d.totalDistanceKm;
      totalDurAll += d.totalTravelTimeMinutes;
    }

    const itineraryResult: ItineraryDto = {
      id: `itin_generated_${Date.now()}`,
      userId: userId || null,
      title: defaultTitle,
      description: `Itinerary terencana otomatis ${totalDays} hari dengan gaya ${style}, tempo ${pace}, dan transportasi ${transportation}.`,
      coverImageUrl:
        generatedDays[0]?.activities[0]?.imageUrl ||
        'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=1200',
      daysCount: totalDays,
      totalDays,
      estimatedBudget: totalItineraryCost,
      totalEstimatedBudget: totalItineraryCost,
      totalDistanceKm: Math.round(totalDistAll * 10) / 10,
      totalTravelTimeMinutes: Math.round(totalDurAll),
      travelStyle: style,
      budgetLevel: dto.budgetLevel || BudgetLevel.MID_RANGE,
      transportationMode:
        (transportation as string) === 'WALKING'
          ? 'WALKING'
          : (transportation as string) === 'MOTORCYCLE'
            ? 'MOTORCYCLE'
            : (transportation as string) === 'CYCLING'
              ? 'CYCLING'
              : 'CAR',
      startLocation: null,
      endLocation: null,
      pace,
      isCustom: false,
      isPublic: false,
      isSaved: Boolean(dto.saveItinerary),
      shareToken: null,
      shareUrl: null,
      startDate: dto.startDate || null,
      endDate: dto.endDate || null,
      days: generatedDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If requested to save and user is logged in, persist to database
    if (dto.saveItinerary && userId) {
      const daysForDb = generatedDays.map((d) => ({
        title: d.title,
        date: d.date ? new Date(d.date) : null,
        notes: d.notes,
        items: d.activities.map((act) => ({
          destinationId: act.destinationId,
          customLocation: null,
          customTitle: act.customTitle,
          orderIndex: act.orderIndex,
          timeSlot: act.timeSlot,
          startTime: act.startTime,
          endTime: act.endTime,
          activityNotes: act.activityNotes,
          estimatedDurationMinutes: act.estimatedDurationMinutes,
          estimatedCost: act.estimatedCost,
          distanceFromPrevKm: act.distanceFromPrevKm,
          travelTimeFromPrevMinutes: act.travelTimeFromPrevMinutes,
          isCompleted: false,
        })),
      }));

      const saved = await this.repository.createWithTransaction(
        {
          userId,
          title: itineraryResult.title,
          description: itineraryResult.description,
          coverImageUrl: itineraryResult.coverImageUrl,
          totalDays: itineraryResult.totalDays,
          totalEstimatedBudget: itineraryResult.totalEstimatedBudget,
          travelStyle: itineraryResult.travelStyle,
          budgetLevel: itineraryResult.budgetLevel,
          transportationMode: itineraryResult.transportationMode,
          startLocation: null,
          endLocation: null,
          pace: itineraryResult.pace,
          isCustom: false,
          isPublic: false,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        daysForDb,
      );

      itineraryResult.id = saved.id;
    }

    return {
      itinerary: itineraryResult,
      summary: {
        totalDays,
        totalStops: totalStopsCount,
        totalEstimatedBudget: totalItineraryCost,
        budgetPerPerson: Math.round(totalItineraryCost / travelers),
        travelStyle: style,
        travelPace: pace,
        transportation,
        optimizedRouteNotes: `Rute telah dioptimalkan berdasarkan jarak Haversine, waktu operasional, dan tempo ${pace}.`,
      },
    };
  }
}

export const itineraryGeneratorService = new ItineraryGeneratorService();
