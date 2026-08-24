import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Health, Readiness & Production Probes (Phase 25)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Root Probes (GET /health, GET /health/ready, GET /health/live)', () => {
    it('GET /health should return { "status": "ok" }', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('GET /health/ready should return database readiness status', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('uptime');
    });

    it('GET /health/live should return system liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Versioned Health Routes (/api/v1/health and /v1/health)', () => {
    it('GET /api/v1/health should return UP status and full system metrics', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'UP');
      expect(response.body.data).toHaveProperty('service', 'Lombok Explorer API');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('database', 'healthy');
    });

    it('GET /api/v1/health/ready should return readiness confirmation', async () => {
      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('database', 'connected');
    });

    it('GET /v1/health should return UP status via legacy alias', async () => {
      const response = await request(app).get('/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'UP');
    });
  });

  describe('Root Discovery (GET /)', () => {
    it('GET / should return welcome payload with API metadata and health links', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Welcome to Lombok Explorer API');
      expect(response.body.data).toHaveProperty('name', 'Lombok Explorer API');
      expect(response.body.data).toHaveProperty('docs', '/api/docs');
      expect(response.body.data).toHaveProperty('health', '/health');
      expect(response.body.data).toHaveProperty('ready', '/health/ready');
    });
  });
});
