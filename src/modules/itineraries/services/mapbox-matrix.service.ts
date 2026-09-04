import { TransportationMode } from '@prisma/client';
import { config } from '../../../config/config';
import { logger } from '../../../common/utils/logger';
import { GeoCoordinate, IMapboxMatrixService, MatrixResult } from './mapbox.types';

export class MapboxMatrixService implements IMapboxMatrixService {
  private readonly token: string;

  constructor(token?: string) {
    this.token = token || config.mapbox.accessToken || '';
  }

  /**
   * Maps application TransportationMode enum to Mapbox routing profile.
   */
  public getMapboxProfile(mode: TransportationMode = 'CAR'): string {
    switch (mode) {
      case 'WALKING':
        return 'mapbox/walking';
      case 'CYCLING':
        return 'mapbox/cycling';
      case 'MOTORCYCLE':
      case 'PUBLIC_TRANSPORT':
      case 'CAR':
      default:
        return 'mapbox/driving';
    }
  }

  /**
   * Computes geodesic distance in kilometers using the Haversine formula.
   */
  public calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return dist > 0 ? Math.max(0.1, Math.round(dist * 100) / 100) : 0;
  }

  /**
   * Estimates travel duration in minutes based on distance and transportation mode.
   */
  public estimateDurationMinutes(distanceKm: number, mode: TransportationMode = 'CAR'): number {
    if (distanceKm <= 0) return 0;
    let speedKmH = 45;
    let bufferMinutes = 5;

    switch (mode) {
      case 'MOTORCYCLE':
        speedKmH = 40;
        bufferMinutes = 3;
        break;
      case 'WALKING':
        speedKmH = 4.5;
        bufferMinutes = 0;
        break;
      case 'CYCLING':
        speedKmH = 15;
        bufferMinutes = 2;
        break;
      case 'PUBLIC_TRANSPORT':
        speedKmH = 35;
        bufferMinutes = 10;
        break;
      case 'CAR':
      default:
        speedKmH = 45;
        bufferMinutes = 5;
        break;
    }

    const calculatedMinutes = (distanceKm / speedKmH) * 60;
    return Math.max(1, Math.round(calculatedMinutes + bufferMinutes));
  }

  /**
   * Internal fallback matrix calculator using Haversine formulas.
   */
  public calculateFallbackMatrix(
    coordinates: GeoCoordinate[],
    mode: TransportationMode = 'CAR',
  ): MatrixResult {
    const n = coordinates.length;
    const distancesKm: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const durationsMinutes: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      const coordA = coordinates[i];
      if (!coordA) continue;
      for (let j = 0; j < n; j++) {
        const coordB = coordinates[j];
        if (!coordB) continue;
        if (i === j) {
          distancesKm[i]![j] = 0;
          durationsMinutes[i]![j] = 0;
        } else {
          const dist = this.calculateHaversineKm(
            coordA.latitude,
            coordA.longitude,
            coordB.latitude,
            coordB.longitude,
          );
          const dur = this.estimateDurationMinutes(dist, mode);
          distancesKm[i]![j] = dist;
          durationsMinutes[i]![j] = dur;
        }
      }
    }

    return { distancesKm, durationsMinutes };
  }

  /**
   * Fetches pairwise distances & durations from Mapbox Matrix API with automatic fallback.
   */
  public async calculateMatrix(
    coordinates: GeoCoordinate[],
    mode: TransportationMode = 'CAR',
  ): Promise<MatrixResult> {
    if (coordinates.length === 0) {
      return { distancesKm: [], durationsMinutes: [] };
    }

    if (coordinates.length === 1) {
      return { distancesKm: [[0]], durationsMinutes: [[0]] };
    }

    if (!this.token) {
      return this.calculateFallbackMatrix(coordinates, mode);
    }

    try {
      const profile = this.getMapboxProfile(mode);
      const coordString = coordinates.map((c) => `${c.longitude},${c.latitude}`).join(';');

      const url = `https://api.mapbox.com/directions-matrix/v1/${profile}/${coordString}?annotations=distance,duration&access_token=${this.token}`;

      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        logger.warn(
          `Mapbox Matrix API returned ${response.status}: falling back to Haversine matrix`,
        );
        return this.calculateFallbackMatrix(coordinates, mode);
      }

      const data = (await response.json()) as {
        code?: string;
        distances?: (number | null)[][];
        durations?: (number | null)[][];
      };

      if (data.code !== 'Ok' || !data.distances || !data.durations) {
        return this.calculateFallbackMatrix(coordinates, mode);
      }

      const n = coordinates.length;
      const distancesKm: number[][] = [];
      const durationsMinutes: number[][] = [];

      for (let i = 0; i < n; i++) {
        const distRow: number[] = [];
        const durRow: number[] = [];
        for (let j = 0; j < n; j++) {
          const rawDist = data.distances[i]?.[j];
          const rawDur = data.durations[i]?.[j];

          if (typeof rawDist === 'number') {
            const km = rawDist / 1000;
            distRow.push(km > 0 ? Math.max(0.1, Math.round(km * 100) / 100) : 0);
          } else {
            const fallbackDist = this.calculateHaversineKm(
              coordinates[i]!.latitude,
              coordinates[i]!.longitude,
              coordinates[j]!.latitude,
              coordinates[j]!.longitude,
            );
            distRow.push(fallbackDist);
          }

          if (typeof rawDur === 'number') {
            const mins = rawDur / 60;
            durRow.push(mins > 0 ? Math.max(1, Math.round(mins)) : 0);
          } else {
            const fallbackDur = this.estimateDurationMinutes(distRow[j] || 0, mode);
            durRow.push(fallbackDur);
          }
        }
        distancesKm.push(distRow);
        durationsMinutes.push(durRow);
      }

      return { distancesKm, durationsMinutes };
    } catch (_error) {
      logger.error('Mapbox Matrix API network error; falling back to Haversine');
      return this.calculateFallbackMatrix(coordinates, mode);
    }
  }
}

export const mapboxMatrixService = new MapboxMatrixService();
