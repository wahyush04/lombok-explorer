import { TransportationMode } from '@prisma/client';
import { config } from '../../../config/config';
import { logger } from '../../../common/utils/logger';
import {
  GeoCoordinate,
  IMapboxOptimizationService,
  OptimizationResult,
  RouteSegmentResult,
} from './mapbox.types';
import { mapboxMatrixService, MapboxMatrixService } from './mapbox-matrix.service';

export class MapboxOptimizationService implements IMapboxOptimizationService {
  private readonly token: string;
  private readonly matrixService: MapboxMatrixService;

  constructor(token?: string, matrixService: MapboxMatrixService = mapboxMatrixService) {
    this.token = token || config.mapbox.accessToken || '';
    this.matrixService = matrixService;
  }

  /**
   * Internal TSP 2-Opt local search optimizer for fast offline route optimization.
   */
  public solveLocalTsp(
    distances: number[][],
    _durations: number[][],
    fixedStartIndex = 0,
    fixedEndIndex?: number,
  ): number[] {
    const n = distances.length;
    if (n <= 2) {
      return Array.from({ length: n }, (_, i) => i);
    }

    // 1. Initial Greedy Nearest Neighbor Tour
    const visited = new Set<number>();
    const tour: number[] = [fixedStartIndex];
    visited.add(fixedStartIndex);

    const hasFixedEnd = typeof fixedEndIndex === 'number' && fixedEndIndex >= 0 && fixedEndIndex < n;
    if (hasFixedEnd && fixedEndIndex !== fixedStartIndex) {
      visited.add(fixedEndIndex);
    }

    while (tour.length < (hasFixedEnd && fixedEndIndex !== fixedStartIndex ? n - 1 : n)) {
      const current = tour[tour.length - 1]!;
      let bestNext = -1;
      let minDistance = Infinity;

      for (let next = 0; next < n; next++) {
        if (!visited.has(next)) {
          const d = distances[current]?.[next] ?? Infinity;
          if (d < minDistance) {
            minDistance = d;
            bestNext = next;
          }
        }
      }

      if (bestNext !== -1) {
        tour.push(bestNext);
        visited.add(bestNext);
      } else {
        // Fallback for disconnected nodes
        for (let i = 0; i < n; i++) {
          if (!visited.has(i)) {
            tour.push(i);
            visited.add(i);
            break;
          }
        }
      }
    }

    if (hasFixedEnd && fixedEndIndex !== fixedStartIndex) {
      tour.push(fixedEndIndex);
    }

    // 2. 2-Opt Iterative Improvement
    let improved = true;
    let iterations = 0;
    const maxIterations = 50;

    const calcTourDistance = (route: number[]): number => {
      let sum = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const u = route[i]!;
        const v = route[i + 1]!;
        sum += distances[u]?.[v] ?? 0;
      }
      return sum;
    };

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      const startK = fixedStartIndex !== undefined ? 1 : 0;
      const endK = hasFixedEnd ? tour.length - 2 : tour.length - 1;

      for (let i = startK; i < endK; i++) {
        for (let k = i + 1; k <= endK; k++) {
          // Reverse sub-array tour[i...k]
          const newTour = [
            ...tour.slice(0, i),
            ...tour.slice(i, k + 1).reverse(),
            ...tour.slice(k + 1),
          ];

          if (calcTourDistance(newTour) < calcTourDistance(tour) - 0.01) {
            tour.splice(0, tour.length, ...newTour);
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return tour;
  }

  /**
   * Builds route segments and totals from an ordered sequence of waypoint indices.
   */
  public buildResultFromOrder(
    orderedIndices: number[],
    coordinates: GeoCoordinate[],
    distances: number[][],
    durations: number[][],
  ): OptimizationResult {
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    const segments: RouteSegmentResult[] = [];

    for (let i = 0; i < orderedIndices.length - 1; i++) {
      const fromIdx = orderedIndices[i]!;
      const toIdx = orderedIndices[i + 1]!;

      const dist = distances[fromIdx]?.[toIdx] ?? 0;
      const dur = durations[fromIdx]?.[toIdx] ?? 0;

      totalDistanceKm += dist;
      totalDurationMinutes += dur;

      segments.push({
        fromActivityId: coordinates[fromIdx]?.id,
        toActivityId: coordinates[toIdx]?.id,
        distanceKm: Math.round(dist * 10) / 10,
        travelTimeMinutes: Math.round(dur),
      });
    }

    return {
      orderedIndices,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMinutes: Math.round(totalDurationMinutes),
      segments,
    };
  }

  /**
   * Optimizes the visitation order of coordinates to minimize travel time.
   */
  public async optimizeRoute(
    coordinates: GeoCoordinate[],
    mode: TransportationMode = 'CAR',
    fixedStartIndex = 0,
    fixedEndIndex?: number,
  ): Promise<OptimizationResult> {
    const n = coordinates.length;
    if (n === 0) {
      return { orderedIndices: [], totalDistanceKm: 0, totalDurationMinutes: 0, segments: [] };
    }

    if (n === 1) {
      return { orderedIndices: [0], totalDistanceKm: 0, totalDurationMinutes: 0, segments: [] };
    }

    // Step 1: Compute pairwise matrix
    const matrix = await this.matrixService.calculateMatrix(coordinates, mode);

    // If no token or small problem, use internal 2-opt solver
    if (!this.token || n <= 2 || n > 12) {
      const localOrder = this.solveLocalTsp(
        matrix.distancesKm,
        matrix.durationsMinutes,
        fixedStartIndex,
        fixedEndIndex,
      );
      return this.buildResultFromOrder(localOrder, coordinates, matrix.distancesKm, matrix.durationsMinutes);
    }

    // Step 2: Try Mapbox Optimization API
    try {
      const profile = this.matrixService.getMapboxProfile(mode);
      const coordString = coordinates.map((c) => `${c.longitude},${c.latitude}`).join(';');
      let url = `https://api.mapbox.com/optimized-trips/v1/${profile}/${coordString}?source=first&roundtrip=false&steps=false&overview=false&access_token=${this.token}`;

      if (typeof fixedEndIndex === 'number' && fixedEndIndex === n - 1) {
        url += '&destination=last';
      } else {
        url += '&destination=any';
      }

      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        logger.warn(
          `Mapbox Optimization API returned ${response.status}: falling back to 2-Opt local optimizer`,
        );
        const localOrder = this.solveLocalTsp(
          matrix.distancesKm,
          matrix.durationsMinutes,
          fixedStartIndex,
          fixedEndIndex,
        );
        return this.buildResultFromOrder(localOrder, coordinates, matrix.distancesKm, matrix.durationsMinutes);
      }

      const data = (await response.json()) as {
        code?: string;
        waypoints?: { waypoint_index: number; trips_index: number }[];
      };

      if (data.code !== 'Ok' || !data.waypoints || data.waypoints.length !== n) {
        const localOrder = this.solveLocalTsp(
          matrix.distancesKm,
          matrix.durationsMinutes,
          fixedStartIndex,
          fixedEndIndex,
        );
        return this.buildResultFromOrder(localOrder, coordinates, matrix.distancesKm, matrix.durationsMinutes);
      }

      // Sort original indices by their waypoint_index in the optimized trip
      const sortedWaypoints = [...data.waypoints].sort(
        (a, b) => a.waypoint_index - b.waypoint_index,
      );
      const orderedIndices = sortedWaypoints.map((w) => data.waypoints!.indexOf(w));

      return this.buildResultFromOrder(orderedIndices, coordinates, matrix.distancesKm, matrix.durationsMinutes);
    } catch (error) {
      logger.error('Mapbox Optimization API network error; using 2-Opt local optimizer fallback');
      const localOrder = this.solveLocalTsp(
        matrix.distancesKm,
        matrix.durationsMinutes,
        fixedStartIndex,
        fixedEndIndex,
      );
      return this.buildResultFromOrder(localOrder, coordinates, matrix.distancesKm, matrix.durationsMinutes);
    }
  }
}

export const mapboxOptimizationService = new MapboxOptimizationService();
