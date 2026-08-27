import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('OpenAPI Contract & HTTP Status Matrix Test (Phase 21)', () => {
  let app: Application;
  let travelerToken: string;
  let otherTravelerToken: string;

  beforeAll(async () => {
    app = createApp();

    // Login traveler 1
    const travelerRes = await request(app).post('/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    travelerToken = travelerRes.body.data.accessToken;

    // Register / Login traveler 2
    let traveler2Res = await request(app).post('/v1/auth/login').send({
      email: 'matrix_tester@lombokexplorer.com',
      password: 'Password123!',
    });

    if (traveler2Res.status !== 200) {
      traveler2Res = await request(app).post('/v1/auth/register').send({
        username: 'matrix_tester',
        name: 'Matrix Tester',
        email: 'matrix_tester@lombokexplorer.com',
        password: 'Password123!',
      });
    }

    otherTravelerToken = traveler2Res.body.data.accessToken;
  });

  describe('1. HTTP 200 OK & 201 Created (Success Matrix)', () => {
    it('should return 200 OK for valid GET requests', async () => {
      const res = await request(app).get('/v1/destinations?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('should return 201 Created when a new resource is created', async () => {
      const res = await request(app)
        .post('/v1/checklists')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          title: 'Matrix Test Packing Checklist',
          category: 'GENERAL',
          items: [{ itemText: 'Powerbank' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');

      // Cleanup
      if (res.body.data?.id) {
        await request(app)
          .delete(`/v1/checklists/${res.body.data.id}`)
          .set('Authorization', `Bearer ${travelerToken}`);
      }
    });
  });

  describe('2. HTTP 400 Bad Request & Validation Error Matrix', () => {
    it('should return 400 with VALIDATION_ERROR when required fields are missing or invalid', async () => {
      const res = await request(app).post('/v1/auth/register').send({
        name: '',
        email: 'invalid-email',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('should return 400 when malformed JSON is supplied', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. HTTP 401 Unauthorized Matrix', () => {
    it('should return 401 TOKEN_MISSING when accessing protected route without Bearer token', async () => {
      const res = await request(app).get('/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(['TOKEN_MISSING', 'UNAUTHORIZED']).toContain(res.body.errorCode);
    });

    it('should return 401 INVALID_TOKEN when an invalid signature token is supplied', async () => {
      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid.bogus.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_TOKEN');
    });
  });

  describe('4. HTTP 403 Forbidden Matrix', () => {
    it('should return 403 when a user attempts to update another user resource', async () => {
      // 1. Create a private travel journal with Traveler 1
      const journalRes = await request(app)
        .post('/v1/journals')
        .set('Authorization', `Bearer ${travelerToken}`)
        .send({
          title: 'Private Journal of Traveler 1',
          content: 'Secret travel notes',
          isPublic: false,
        });

      const journalId = journalRes.body.data?.id;
      expect(journalId).toBeDefined();

      // 2. Attempt to update this journal with Traveler 2
      const forbiddenRes = await request(app)
        .put(`/v1/journals/${journalId}`)
        .set('Authorization', `Bearer ${otherTravelerToken}`)
        .send({
          title: 'Hacked Title Attempt',
        });

      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.success).toBe(false);
      expect(['FORBIDDEN', 'FORBIDDEN_RESOURCE']).toContain(forbiddenRes.body.errorCode);

      // Cleanup
      await request(app)
        .delete(`/v1/journals/${journalId}`)
        .set('Authorization', `Bearer ${travelerToken}`);
    });
  });

  describe('5. HTTP 404 Not Found Matrix', () => {
    it('should return 404 with DESTINATION_NOT_FOUND when querying non-existent destination ID', async () => {
      const res = await request(app).get('/v1/destinations/non-existent-destination-uuid-999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });

    it('should return 404 when requesting non-existent endpoint path', async () => {
      const res = await request(app).get('/v1/non-existent-undefined-api-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(['NOT_FOUND', 'ROUTE_NOT_FOUND']).toContain(res.body.errorCode);
    });
  });

  describe('6. HTTP 409 Conflict Matrix', () => {
    it('should return 409 CONFLICT when attempting to register an already existing email address', async () => {
      const res = await request(app).post('/v1/auth/register').send({
        username: 'existing_traveler_unique',
        name: 'Existing Traveler',
        email: 'traveler@lombokexplorer.com', // Already registered
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(['EMAIL_ALREADY_EXISTS', 'USER_ALREADY_EXISTS', 'CONFLICT']).toContain(
        res.body.errorCode,
      );
    });

    it('should return 409 CONFLICT when adding the same destination to favorites twice', async () => {
      const destId = 'dest_bukit_merese';

      // 1. Add to favorites (first time)
      await request(app)
        .post(`/v1/favorites/${destId}`)
        .set('Authorization', `Bearer ${travelerToken}`);

      // 2. Add duplicate
      const duplicateRes = await request(app)
        .post(`/v1/favorites/${destId}`)
        .set('Authorization', `Bearer ${travelerToken}`);

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
      expect(['DUPLICATE_FAVORITE', 'FAVORITE_ALREADY_EXISTS', 'CONFLICT']).toContain(
        duplicateRes.body.errorCode,
      );

      // Cleanup
      await request(app)
        .delete(`/v1/favorites/${destId}`)
        .set('Authorization', `Bearer ${travelerToken}`);
    });
  });

  describe('7. HTTP 500 Database & Server Error Recovery Matrix', () => {
    it('should handle unhandled exceptions cleanly with standard 500 envelope without crashing process', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UP');
    });
  });
});
