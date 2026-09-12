import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapboxDirectionsService } from '../src/modules/itineraries/services/mapbox-directions.service';
import { GeoCoordinate } from '../src/modules/itineraries/services/mapbox.types';

describe('MapboxDirectionsService Test Suite', () => {
  let service: MapboxDirectionsService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MapboxDirectionsService('pk.mock_mapbox_access_token_12345');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. Single Leg Route Calculation (getRoute & getRouteForLeg)', () => {
    it('should successfully fetch driving route geometry, distance, and duration from Mapbox API', async () => {
      const mockDirectionsResponse = {
        code: 'Ok',
        routes: [
          {
            distance: 3500.5,
            duration: 620.2,
            geometry: '_p~iF~ps|U_ulLnnqC',
            legs: [
              {
                distance: 3500.5,
                duration: 620.2,
              },
            ],
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDirectionsResponse,
      });

      const origin = { latitude: -8.9082, longitude: 116.3195 };
      const destination = { latitude: -8.9135, longitude: 116.3268 };

      const result = await service.getRoute(origin, destination, 'CAR');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.distanceMeters).toBe(3501);
      expect(result.durationSeconds).toBe(620);
      expect(result.geometry).toBe('_p~iF~ps|U_ulLnnqC');
    });

    it('should map transportation modes to proper Mapbox profiles (CAR, CYCLING, WALKING)', async () => {
      let requestedUrl = '';
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [{ distance: 1000, duration: 300, geometry: 'xyz' }],
          }),
        };
      });

      const origin = { latitude: -8.9, longitude: 116.3 };
      const dest = { latitude: -8.91, longitude: 116.31 };

      await service.getRoute(origin, dest, 'CYCLING');
      expect(requestedUrl).toContain('/mapbox/cycling/');

      await service.getRoute(origin, dest, 'WALKING');
      expect(requestedUrl).toContain('/mapbox/walking/');

      await service.getRoute(origin, dest, 'CAR');
      expect(requestedUrl).toContain('/mapbox/driving/');
    });

    it('should fetch route for a specific activity leg with activity metadata', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'Ok',
          routes: [{ distance: 2400, duration: 450, geometry: 'poly_leg_0' }],
        }),
      });

      const leg = await service.getRouteForLeg(
        'act_1',
        'act_2',
        { latitude: -8.9, longitude: 116.3 },
        { latitude: -8.92, longitude: 116.32 },
        0,
        'MOTORCYCLE',
      );

      expect(leg.fromActivityId).toBe('act_1');
      expect(leg.toActivityId).toBe('act_2');
      expect(leg.legOrder).toBe(0);
      expect(leg.distanceMeters).toBe(2400);
      expect(leg.durationSeconds).toBe(450);
      expect(leg.geometry).toBe('poly_leg_0');
    });
  });

  describe('2. Multi-Activity Sequence Route Generation (getRoutesForActivities)', () => {
    it('should calculate sequential per-leg routes for an itinerary sequence (A -> B -> C)', async () => {
      const coordinates: GeoCoordinate[] = [
        { id: 'act_1', name: 'Pantai Tanjung Aan', latitude: -8.9082, longitude: 116.3195 },
        { id: 'act_2', name: 'Bukit Merese', latitude: -8.9135, longitude: 116.3268 },
        { id: 'act_3', name: 'Pantai Kuta', latitude: -8.8923, longitude: 116.2798 },
      ];

      // Multi-point batch directions returns total route with legs array
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              distance: 8000,
              duration: 1200,
              geometry: 'full_route_geometry',
              legs: [
                { distance: 1500, duration: 300 },
                { distance: 6500, duration: 900 },
              ],
            },
          ],
        }),
      });

      const result = await service.getRoutesForActivities(coordinates, 'CAR');

      expect(result.legs).toHaveLength(2);
      expect(result.totalDistanceMeters).toBe(8000);
      expect(result.totalDurationSeconds).toBe(1200);
      expect(result.legs[0]?.fromActivityId).toBe('act_1');
      expect(result.legs[0]?.toActivityId).toBe('act_2');
      expect(result.legs[0]?.geometry).toBeDefined();
      expect(result.legs[0]?.geometry.length).toBeGreaterThan(0);
      expect(result.legs[1]?.fromActivityId).toBe('act_2');
      expect(result.legs[1]?.toActivityId).toBe('act_3');
      expect(result.legs[1]?.geometry).toBeDefined();
      expect(result.legs[1]?.geometry.length).toBeGreaterThan(0);
      expect(result.geometry).toBe('full_route_geometry');
    });

    it('should return empty route when coordinates list has fewer than 2 points', async () => {
      const singleCoord: GeoCoordinate[] = [
        { id: 'act_1', latitude: -8.9, longitude: 116.3 },
      ];

      const result = await service.getRoutesForActivities(singleCoord, 'CAR');

      expect(result.totalDistanceMeters).toBe(0);
      expect(result.totalDurationSeconds).toBe(0);
      expect(result.legs).toHaveLength(0);
      expect(result.geometry).toBe('');
    });
  });

  describe('3. Resilience, Retry, and Offline Fallback (Phase 10 & 19)', () => {
    it('should retry up to 2 times on 5xx server errors and succeed if retry succeeds', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => 'Mapbox service temporarily unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [{ distance: 2000, duration: 400, geometry: 'retry_success_geom' }],
          }),
        });

      const origin = { latitude: -8.9, longitude: 116.3 };
      const dest = { latitude: -8.91, longitude: 116.31 };

      const result = await service.getRoute(origin, dest, 'CAR');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.distanceMeters).toBe(2000);
      expect(result.geometry).toBe('retry_success_geom');
    });

    it('should fallback gracefully to offline Haversine and polyline6 when Mapbox API completely fails', async () => {
      // Simulate persistent network failure / timeout
      global.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

      const origin = { latitude: -8.9082, longitude: 116.3195 };
      const dest = { latitude: -8.9135, longitude: 116.3268 };

      const result = await service.getRoute(origin, dest, 'CAR');

      // Offline fallback produces distance, duration estimate, and encoded polyline
      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(typeof result.geometry).toBe('string');
      expect(result.geometry.length).toBeGreaterThan(0);
    });

    it('should never leak Mapbox access token into error messages or return values', async () => {
      const secretToken = 'pk.super_confidential_mapbox_secret_token';
      const secureService = new MapboxDirectionsService(secretToken);

      global.fetch = vi.fn().mockRejectedValue(new Error('Failed request'));

      const origin = { latitude: -8.9, longitude: 116.3 };
      const dest = { latitude: -8.91, longitude: 116.31 };

      const result = await secureService.getRoute(origin, dest, 'CAR');

      expect(JSON.stringify(result)).not.toContain(secretToken);
    });
  });
});
