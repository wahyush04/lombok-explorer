import { TransportationMode } from '@prisma/client';
import { logger } from '../../../common/utils/logger';
import {
  DirectionsLegResult,
  DirectionsRouteResult,
  GeoCoordinate,
  IMapboxDirectionsService,
} from './mapbox.types';

export class MapboxDirectionsService implements IMapboxDirectionsService {
  private readonly token: string | undefined;
  private readonly baseUrl = 'https://api.mapbox.com/directions/v5/mapbox';
  private readonly requestTimeoutMs = 5000;
  private readonly maxRetries = 2;

  constructor(token?: string) {
    this.token = token ?? process.env.MAPBOX_ACCESS_TOKEN;
    if (!this.token) {
      logger.warn('MAPBOX_ACCESS_TOKEN not set. MapboxDirectionsService will use offline fallback geometry.');
    }
  }

  /**
   * Maps internal TransportationMode to Mapbox Directions routing profile.
   */
  private mapProfile(mode: TransportationMode = 'CAR'): string {
    switch (mode) {
      case 'WALKING':
        return 'walking';
      case 'CYCLING':
        return 'cycling';
      case 'MOTORCYCLE':
      case 'PUBLIC_TRANSPORT':
      case 'CAR':
      default:
        return 'driving';
    }
  }

  /**
   * Calculates Haversine distance in meters between two coordinate points.
   */
  public calculateHaversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Estimates duration in seconds based on mode and distance in meters.
   */
  public estimateDurationSeconds(
    distanceMeters: number,
    mode: TransportationMode = 'CAR',
  ): number {
    let speedMetersPerSecond = 8.33; // ~30 km/h for driving in Lombok
    switch (mode) {
      case 'WALKING':
        speedMetersPerSecond = 1.39; // ~5 km/h
        break;
      case 'CYCLING':
        speedMetersPerSecond = 4.17; // ~15 km/h
        break;
      case 'MOTORCYCLE':
        speedMetersPerSecond = 9.72; // ~35 km/h
        break;
      case 'PUBLIC_TRANSPORT':
      case 'CAR':
      default:
        speedMetersPerSecond = 8.33;
        break;
    }

    const calculatedSeconds = Math.round(distanceMeters / speedMetersPerSecond);
    return Math.max(30, calculatedSeconds);
  }

  /**
   * Encodes coordinates array into a standard Polyline (default precision 6).
   */
  public encodePolyline(
    coordinates: { latitude: number; longitude: number }[],
    precision = 6,
  ): string {
    const factor = Math.pow(10, precision);
    let output = '';
    let prevLat = 0;
    let prevLon = 0;

    for (const coord of coordinates) {
      const lat = Math.round(coord.latitude * factor);
      const lon = Math.round(coord.longitude * factor);

      output += this.encodeSignedNumber(lat - prevLat);
      output += this.encodeSignedNumber(lon - prevLon);

      prevLat = lat;
      prevLon = lon;
    }

    return output;
  }

  private encodeSignedNumber(num: number): string {
    let sgnNum = num < 0 ? ~(num << 1) : num << 1;
    let encodeString = '';
    while (sgnNum >= 0x20) {
      encodeString += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
      sgnNum >>= 5;
    }
    encodeString += String.fromCharCode(sgnNum + 63);
    return encodeString;
  }

  /**
   * Executes an HTTP fetch with timeout and bounded exponential backoff retries.
   */
  private async fetchWithRetry(url: string, retryCount = 0): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status >= 500 && retryCount < this.maxRetries) {
        const backoffMs = Math.pow(2, retryCount) * 200;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.fetchWithRetry(url, retryCount + 1);
      }

      return response;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (retryCount < this.maxRetries) {
        const backoffMs = Math.pow(2, retryCount) * 200;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.fetchWithRetry(url, retryCount + 1);
      }
      throw err;
    }
  }

  /**
   * Sanitizes URLs and messages to ensure Mapbox token is NEVER logged or leaked.
   */
  private sanitizeError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    if (!this.token) return raw;
    return raw.replace(new RegExp(this.token, 'g'), '[REDACTED_MAPBOX_TOKEN]');
  }

  /**
   * Retrieves route geometry, distance, and duration between two points.
   */
  public async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: TransportationMode = 'CAR',
  ): Promise<{ distanceMeters: number; durationSeconds: number; geometry: string }> {
    if (!this.token) {
      return this.fallbackRoute(origin, destination, mode);
    }

    const profile = this.mapProfile(mode);
    const coordsParam = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${this.baseUrl}/${profile}/${coordsParam}?geometries=polyline6&overview=full&steps=false&access_token=${this.token}`;

    try {
      const res = await this.fetchWithRetry(url);
      if (!res.ok) {
        const statusText = res.statusText;
        logger.warn(`Mapbox Directions API returned HTTP ${res.status}: ${statusText}. Falling back to geometric route.`);
        return this.fallbackRoute(origin, destination, mode);
      }

      const data = (await res.json()) as {
        code?: string;
        routes?: { distance: number; duration: number; geometry: string }[];
      };

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        logger.warn(`Mapbox Directions API returned non-OK code: ${data.code}. Falling back.`);
        return this.fallbackRoute(origin, destination, mode);
      }

      const primary = data.routes[0]!;
      return {
        distanceMeters: Math.round(primary.distance),
        durationSeconds: Math.round(primary.duration),
        geometry: primary.geometry,
      };
    } catch (err: unknown) {
      logger.warn(`Mapbox Directions call failed (${this.sanitizeError(err)}). Using fallback calculation.`);
      return this.fallbackRoute(origin, destination, mode);
    }
  }

  /**
   * Fallback geometric calculation when Mapbox is unavailable or offline.
   */
  private fallbackRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: TransportationMode,
  ): { distanceMeters: number; durationSeconds: number; geometry: string } {
    const distanceMeters = this.calculateHaversineMeters(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );
    const durationSeconds = this.estimateDurationSeconds(distanceMeters, mode);
    const geometry = this.encodePolyline([origin, destination], 6);

    return { distanceMeters, durationSeconds, geometry };
  }

  /**
   * Computes route for a specific leg between activities.
   */
  public async getRouteForLeg(
    fromActivityId: string | null,
    toActivityId: string,
    fromCoord: { latitude: number; longitude: number },
    toCoord: { latitude: number; longitude: number },
    legOrder = 0,
    mode: TransportationMode = 'CAR',
  ): Promise<DirectionsLegResult> {
    const route = await this.getRoute(fromCoord, toCoord, mode);
    return {
      fromActivityId,
      toActivityId,
      legOrder,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry,
    };
  }

  /**
   * Computes per-leg directions and overall route for a sequence of activities.
   */
  public async getRoutesForActivities(
    coordinates: GeoCoordinate[],
    mode: TransportationMode = 'CAR',
  ): Promise<DirectionsRouteResult> {
    if (coordinates.length < 2) {
      return {
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        geometry: '',
        legs: [],
      };
    }

    const n = coordinates.length;

    // If Mapbox token is present, try batch Directions API call first (up to 25 coordinates)
    if (this.token && n <= 25) {
      const profile = this.mapProfile(mode);
      const coordsParam = coordinates.map((c) => `${c.longitude},${c.latitude}`).join(';');
      const url = `${this.baseUrl}/${profile}/${coordsParam}?geometries=polyline6&overview=full&steps=false&access_token=${this.token}`;

      try {
        const res = await this.fetchWithRetry(url);
        if (res.ok) {
          const data = (await res.json()) as {
            code?: string;
            routes?: {
              distance: number;
              duration: number;
              geometry: string;
              legs?: { distance: number; duration: number }[];
            }[];
          };

          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const primary = data.routes[0]!;
            const legs: DirectionsLegResult[] = [];

            for (let i = 0; i < n - 1; i++) {
              const from = coordinates[i]!;
              const to = coordinates[i + 1]!;
              const mapboxLeg = primary.legs?.[i];

              const legDistMeters = mapboxLeg ? Math.round(mapboxLeg.distance) : this.calculateHaversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
              const legDurSeconds = mapboxLeg ? Math.round(mapboxLeg.duration) : this.estimateDurationSeconds(legDistMeters, mode);
              const legGeometry = this.encodePolyline([from, to], 6);

              legs.push({
                fromActivityId: from.id || null,
                toActivityId: to.id || `activity_${i + 1}`,
                legOrder: i,
                distanceMeters: legDistMeters,
                durationSeconds: legDurSeconds,
                geometry: legGeometry,
              });
            }

            return {
              totalDistanceMeters: Math.round(primary.distance),
              totalDurationSeconds: Math.round(primary.duration),
              geometry: primary.geometry,
              legs,
            };
          }
        }
      } catch (err: unknown) {
        logger.warn(`Batch Mapbox Directions failed (${this.sanitizeError(err)}). Processing pairwise legs.`);
      }
    }

    // Pairwise calculation fallback
    const legs: DirectionsLegResult[] = [];
    let totalDistMeters = 0;
    let totalDurSeconds = 0;

    for (let i = 0; i < n - 1; i++) {
      const from = coordinates[i]!;
      const to = coordinates[i + 1]!;

      const leg = await this.getRouteForLeg(
        from.id || null,
        to.id || `activity_${i + 1}`,
        from,
        to,
        i,
        mode,
      );

      totalDistMeters += leg.distanceMeters;
      totalDurSeconds += leg.durationSeconds;
      legs.push(leg);
    }

    const fullGeometry = this.encodePolyline(coordinates, 6);

    return {
      totalDistanceMeters: totalDistMeters,
      totalDurationSeconds: totalDurSeconds,
      geometry: fullGeometry,
      legs,
    };
  }
}

export const mapboxDirectionsService = new MapboxDirectionsService();
