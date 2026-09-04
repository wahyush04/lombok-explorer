import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin OpenAPI / Swagger Documentation Suite (Phase 18)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('1. Swagger UI Endpoints for Admin Documentation', () => {
    it('should serve Admin Swagger UI at GET /api/docs/admin', async () => {
      const res = await request(app).get('/api/docs/admin/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('Lombok Explorer Admin API');
    });

    it('should serve Admin Swagger UI alias at GET /docs/admin', async () => {
      const res = await request(app).get('/docs/admin/');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('Lombok Explorer Admin API');
    });

    it('should serve Admin OpenAPI JSON at GET /api/docs/admin/json', async () => {
      const res = await request(app).get('/api/docs/admin/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('openapi', '3.0.3');
      expect(res.body.info).toHaveProperty('title', 'Lombok Explorer Admin API');
      expect(res.body).toHaveProperty('paths');
      expect(res.body).toHaveProperty('components');
    });

    it('should serve Admin OpenAPI YAML at GET /api/docs/admin/yaml', async () => {
      const res = await request(app).get('/api/docs/admin/yaml');

      expect(res.status).toBe(200);
      expect(res.text).toContain('openapi: 3.0.3');
      expect(res.text).toContain('Lombok Explorer Admin API');
    });
  });

  describe('2. Required Standard Admin Tags Verification', () => {
    const requiredTags = [
      'Admin Authentication',
      'Admin Dashboard',
      'Admin Destinations',
      'Admin Categories',
      'Admin Restaurants',
      'Admin Accommodations',
      'Admin Users',
      'Admin Reviews',
      'Admin Audit Logs',
      'Admin Feeds & Moderation',
      'Admin Itinerary Templates',
    ];

    it('should contain all 11 required administrative tags', async () => {
      const res = await request(app).get('/api/docs/admin/json');
      const doc = res.body;

      const tagNames = doc.tags.map((t: { name: string }) => t.name);
      for (const reqTag of requiredTags) {
        expect(tagNames).toContain(reqTag);
      }
    });

    it('should tag all operations with one of the standardized Admin tags', async () => {
      const res = await request(app).get('/api/docs/admin/json');
      const doc = res.body;

      for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete'];
        for (const m of methods) {
          const op = (pathItem as any)[m];
          if (op && op.tags) {
            for (const tag of op.tags) {
              expect(requiredTags).toContain(tag);
            }
          }
        }
      }
    });
  });

  describe('3. Security & Schema Completeness', () => {
    it('should define BearerAuth security scheme in components', async () => {
      const res = await request(app).get('/api/docs/admin/json');
      const doc = res.body;

      expect(doc.components.securitySchemes).toHaveProperty('BearerAuth');
      expect(doc.components.securitySchemes.BearerAuth.type).toBe('http');
      expect(doc.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
    });

    it('should document validation error schemas and error envelopes', async () => {
      const res = await request(app).get('/api/docs/admin/json');
      const doc = res.body;

      expect(doc.components.schemas).toHaveProperty('ErrorResponse');
      expect(doc.components.schemas).toHaveProperty('AdminDestinationDto');
      expect(doc.components.schemas).toHaveProperty('AdminCategoryDto');
      expect(doc.components.schemas).toHaveProperty('AdminRestaurantDto');
      expect(doc.components.schemas).toHaveProperty('AdminAccommodationDto');
      expect(doc.components.schemas).toHaveProperty('AdminUserDto');
      expect(doc.components.schemas).toHaveProperty('AdminReviewDto');
      expect(doc.components.schemas).toHaveProperty('AdminAuditLogDto');
      expect(doc.components.schemas).toHaveProperty('AdminItineraryTemplateDto');
    });
  });
});
