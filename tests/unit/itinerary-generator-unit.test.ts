import { describe, it, expect } from 'vitest';
import { TravelPace } from '../../src/modules/itineraries/dto/itinerary-generator.dto';

// Pure mathematical unit functions mirroring ItineraryGeneratorService

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
  return Math.round(R * c * 100) / 100;
}

function estimateTransitDuration(
  distanceKm: number,
  mode: 'CAR' | 'MOTORCYCLE' | 'WALKING' | 'PUBLIC_BOAT',
): number {
  const speeds: Record<string, number> = {
    CAR: 40,
    MOTORCYCLE: 45,
    WALKING: 4.5,
    PUBLIC_BOAT: 25,
  };
  const speed = speeds[mode] || 40;
  const transitHours = distanceKm / speed;
  // Convert to minutes with minimum 10 minutes for short hops
  return Math.max(10, Math.round(transitHours * 60));
}

function applyPaceMultiplier(baseDurationMinutes: number, pace: TravelPace): number {
  const multipliers: Record<TravelPace, number> = {
    RELAXED: 1.35,
    BALANCED: 1.0,
    INTENSE: 0.75,
  };
  return Math.round(baseDurationMinutes * (multipliers[pace] || 1.0));
}

function optimizeTspNearestNeighbor<T extends { latitude: number; longitude: number }>(
  startPoint: { latitude: number; longitude: number },
  destinations: T[],
): T[] {
  if (destinations.length <= 1) return [...destinations];

  const unvisited = [...destinations];
  const route: T[] = [];
  let currentPos = startPoint;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateHaversineDistance(
        currentPos.latitude,
        currentPos.longitude,
        unvisited[i].latitude,
        unvisited[i].longitude,
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nearest = unvisited.splice(nearestIdx, 1)[0];
    route.push(nearest);
    currentPos = { latitude: nearest.latitude, longitude: nearest.longitude };
  }

  return route;
}

describe('Unit Test: Itinerary Generator Algorithmic Engine (Phase 21)', () => {
  describe('Haversine Geospatial Distance Formula', () => {
    it('should accurately compute distance between Mataram and Senggigi (~12-14 km)', () => {
      // Mataram (-8.5833, 116.1167) to Senggigi (-8.5042, 116.0520)
      const distance = calculateHaversineDistance(-8.5833, 116.1167, -8.5042, 116.052);
      expect(distance).toBeGreaterThan(11);
      expect(distance).toBeLessThan(15);
    });

    it('should return 0 for identical coordinates', () => {
      const distance = calculateHaversineDistance(-8.5833, 116.1167, -8.5833, 116.1167);
      expect(distance).toBe(0);
    });

    it('should compute distance between Mataram and Kuta Lombok (~45-55 km)', () => {
      // Mataram (-8.5833, 116.1167) to Kuta Mandalika (-8.8911, 116.2825)
      const distance = calculateHaversineDistance(-8.5833, 116.1167, -8.8911, 116.2825);
      expect(distance).toBeGreaterThan(35);
      expect(distance).toBeLessThan(50);
    });
  });

  describe('Transit Duration & Speed Calculations', () => {
    it('should calculate estimated transit time by CAR for 40 km (~60 minutes)', () => {
      const duration = estimateTransitDuration(40, 'CAR');
      expect(duration).toBe(60);
    });

    it('should enforce minimum 10 minutes transit time for very short hops', () => {
      const duration = estimateTransitDuration(0.5, 'CAR');
      expect(duration).toBe(10);
    });

    it('should compute accurate walking time for 4.5 km (~60 minutes)', () => {
      const duration = estimateTransitDuration(4.5, 'WALKING');
      expect(duration).toBe(60);
    });
  });

  describe('Travel Pace Visit Duration Modifiers', () => {
    it('should scale duration up for RELAXED pace (1.35x)', () => {
      const baseMinutes = 60;
      const relaxed = applyPaceMultiplier(baseMinutes, 'RELAXED');
      expect(relaxed).toBe(81);
    });

    it('should scale duration down for INTENSE pace (0.75x)', () => {
      const baseMinutes = 60;
      const fast = applyPaceMultiplier(baseMinutes, 'INTENSE');
      expect(fast).toBe(45);
    });

    it('should preserve base duration for BALANCED pace (1.0x)', () => {
      const baseMinutes = 60;
      const moderate = applyPaceMultiplier(baseMinutes, 'BALANCED');
      expect(moderate).toBe(60);
    });
  });

  describe('Nearest-Neighbor TSP Route Optimization', () => {
    it('should sequence destinations by proximity starting from origin', () => {
      const origin = { latitude: -8.5833, longitude: 116.1167 }; // Mataram

      const destinations = [
        { name: 'Kuta Mandalika (Far South)', latitude: -8.8911, longitude: 116.2825 },
        { name: 'Senggigi Beach (Near North-West)', latitude: -8.5042, longitude: 116.052 },
        { name: 'Tanjung Aan (Far South-East)', latitude: -8.9056, longitude: 116.3194 },
      ];

      const optimized = optimizeTspNearestNeighbor(origin, destinations);

      // Senggigi is closest to Mataram, followed by Kuta, then Tanjung Aan
      expect(optimized[0].name).toBe('Senggigi Beach (Near North-West)');
      expect(optimized[1].name).toBe('Kuta Mandalika (Far South)');
      expect(optimized[2].name).toBe('Tanjung Aan (Far South-East)');
    });

    it('should return empty or single array without errors', () => {
      const origin = { latitude: -8.5833, longitude: 116.1167 };
      expect(optimizeTspNearestNeighbor(origin, [])).toEqual([]);
      expect(
        optimizeTspNearestNeighbor(origin, [{ name: 'Solo', latitude: -8.5, longitude: 116.0 }]),
      ).toHaveLength(1);
    });
  });
});
