import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Application } from 'express';
import { weatherService } from '../src/modules/weather/weather.service';
import { mockWeatherProvider } from '../src/modules/weather/providers';

describe('API Versioning Architecture (Phase 23)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
    weatherService.setProvider(mockWeatherProvider);
  });

  describe('Primary Version 1: /api/v1', () => {
    it('should access health check via /api/v1/health', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('uptime');
    });

    it('should query destinations via /api/v1/destinations', async () => {
      const response = await request(app).get('/api/v1/destinations?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page', 1);
    });

    it('should validate login payload via /api/v1/auth/login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should require authentication for protected /api/v1/itineraries creation', async () => {
      const response = await request(app)
        .post('/api/v1/itineraries')
        .send({ title: 'My Trip', startDate: '2026-09-10', endDate: '2026-09-12' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should query categories via /api/v1/categories', async () => {
      const response = await request(app).get('/api/v1/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should query recommendations via /api/v1/recommendations', async () => {
      const response = await request(app).get('/api/v1/recommendations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should query weather via /api/v1/weather', async () => {
      const response = await request(app).get('/api/v1/weather');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location');
    });
  });

  describe('Backward Compatibility Alias: /v1', () => {
    it('should still support /v1/destinations transparently', async () => {
      const response = await request(app).get('/v1/destinations?limit=2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should still support /v1/health transparently', async () => {
      const response = await request(app).get('/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Extensible Version 2 Preview: /api/v2 and /v2', () => {
    it('should serve /api/v2/info without altering v1 routes', async () => {
      const response = await request(app).get('/api/v2/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiVersion', 'v2');
      expect(response.body.data.supportedVersions).toContain('v1');
      expect(response.body.data.supportedVersions).toContain('v2');
    });

    it('should also serve /v2/info via alias', async () => {
      const response = await request(app).get('/v2/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiVersion', 'v2');
    });
  });

  describe('Root Metadata and Discovery', () => {
    it('should return welcome metadata with v1 and v2 links', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiV1');
      expect(response.body.data).toHaveProperty('docs', '/api/docs');
    });
  });
});
