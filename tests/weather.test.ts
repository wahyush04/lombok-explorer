import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { weatherService } from '../src/modules/weather/weather.service';
import { mockWeatherProvider, weatherApiProvider } from '../src/modules/weather/providers';

describe('Weather API Module (Phase 16)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    // Clear cache before tests to ensure deterministic results
    weatherService.clearCache();
  });

  describe('GET /v1/weather (Current Weather & Provider Abstraction)', () => {
    it('should return current weather data for default location (Mataram)', async () => {
      const response = await request(app).get('/v1/weather');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location');
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('meta');

      const { location, current, meta } = response.body.data;
      expect(location.name).toContain('Mataram');
      expect(location).toHaveProperty('country');
      expect(location).toHaveProperty('latitude');
      expect(location).toHaveProperty('longitude');

      expect(current).toHaveProperty('temperatureC');
      expect(typeof current.temperatureC).toBe('number');
      expect(current).toHaveProperty('condition');
      expect(current.condition).toHaveProperty('text');
      expect(current.condition).toHaveProperty('icon');
      expect(current).toHaveProperty('humidity');
      expect(current).toHaveProperty('windKph');

      expect(meta.provider).toBe('WeatherAPI');
      expect(meta.cached).toBe(false);
    });

    it('should query weather by specific Lombok region (LOMBOK_SELATAN)', async () => {
      const response = await request(app).get('/v1/weather?region=LOMBOK_SELATAN');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.location.name).toBeDefined();
    });

    it('should query weather by latitude and longitude coordinates', async () => {
      const response = await request(app).get('/v1/weather?lat=-8.5833&lng=116.1167');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.current.temperatureC).toBeDefined();
    });

    it('should return current weather data via /api/v1/weather/current alias', async () => {
      const response = await request(app).get('/api/v1/weather/current');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location');
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data.current.temperatureC).toBeDefined();
    });

    it('should serve subsequent requests from in-memory cache', async () => {
      // 1. Initial request (cache miss)
      const res1 = await request(app).get('/v1/weather?location=Senggigi');
      expect(res1.status).toBe(200);
      expect(res1.body.data.meta.cached).toBe(false);

      // 2. Second request (cache hit)
      const res2 = await request(app).get('/v1/weather?location=Senggigi');
      expect(res2.status).toBe(200);
      expect(res2.body.data.meta.cached).toBe(true);
      expect(res2.body.data.meta.cachedAt).toBe(res1.body.data.meta.cachedAt);
    });

    it('should allow hot-swapping provider to MockWeatherProvider', async () => {
      // Switch to mock provider
      weatherService.setProvider(mockWeatherProvider);
      expect(weatherService.getActiveProviderName()).toBe('MockWeatherProvider');

      const response = await request(app).get('/v1/weather?location=Gili Trawangan');
      expect(response.status).toBe(200);
      expect(response.body.data.meta.provider).toBe('MockWeatherProvider');
      expect(response.body.data.current.condition.text).toBe('Sunny & Clear');

      // Restore to official WeatherApiProvider
      weatherService.setProvider(weatherApiProvider);
      expect(weatherService.getActiveProviderName()).toBe('WeatherAPI');
    });

    it('should return 404 when an unknown location is queried', async () => {
      const response = await request(app).get('/v1/weather?q=non_existent_fake_city_xyz_12345');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('WEATHER_LOCATION_NOT_FOUND');
    });
  });
});
