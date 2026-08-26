import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Destinations API Module (Phase 8)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /v1/destinations (List with Pagination & Filters)', () => {
    it('should return paginated destinations with default limits, caching headers, and enhanced metadata', async () => {
      const response = await request(app).get('/v1/destinations?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(5);

      // Verify Caching Headers
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['vary']).toBeDefined();

      // Verify Enhanced Pagination Metadata for Android & Web
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        currentPage: 1,
        totalCount: expect.any(Number),
        hasNextPage: true,
        hasPrevPage: false,
      });
      expect(response.body.meta.total).toBeGreaterThanOrEqual(30);

      // Verify destination object structure
      const first = response.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('slug');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('categoryId');
      expect(first).toHaveProperty('categoryName');
      expect(first).toHaveProperty('latitude');
      expect(first).toHaveProperty('longitude');
      expect(first).toHaveProperty('isFavorite');
      expect(Array.isArray(first.tags)).toBe(true);
      expect(Array.isArray(first.facilities)).toBe(true);
      expect(Array.isArray(first.images)).toBe(true);
    });

    it('should filter destinations by category slug (e.g. beach)', async () => {
      const response = await request(app).get('/v1/destinations?category=beach');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((item: any) => {
        expect(item.categorySlug).toBe('beach');
      });
    });

    it('should filter destinations by difficulty level (e.g. EXTREME)', async () => {
      const response = await request(app).get('/v1/destinations?difficulty=EXTREME');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      const rinjani = response.body.data.find((d: any) => d.slug === 'gunung-rinjani');
      expect(rinjani).toBeDefined();
      expect(rinjani.difficulty).toBe('EXTREME');
    });

    it('should filter destinations by minimum rating (e.g. min_rating=4.8)', async () => {
      const response = await request(app).get('/v1/destinations?min_rating=4.8');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((item: any) => {
        expect(item.rating).toBeGreaterThanOrEqual(4.8);
      });
    });

    it('should filter destinations by maximum ticket price (e.g. max_price=15000)', async () => {
      const response = await request(app).get('/v1/destinations?max_price=15000');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((item: any) => {
        expect(item.entranceFee).toBeLessThanOrEqual(15000);
      });
    });

    it('should sort destinations by rating descending', async () => {
      const response = await request(app).get('/v1/destinations?sort_by=rating&order=desc');

      expect(response.status).toBe(200);
      const ratings = response.body.data.map((d: any) => d.rating);
      for (let i = 0; i < ratings.length - 1; i++) {
        expect(ratings[i]).toBeGreaterThanOrEqual(ratings[i + 1]);
      }
    });

    it('should sort destinations by name ascending', async () => {
      const response = await request(app).get('/v1/destinations?sort_by=name&order=asc');

      expect(response.status).toBe(200);
      const names = response.body.data.map((d: any) => d.name);
      for (let i = 0; i < names.length - 1; i++) {
        expect(names[i].localeCompare(names[i + 1])).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('GET /v1/destinations/featured', () => {
    it('should return featured destinations with isFeatured = true', async () => {
      const response = await request(app).get('/v1/destinations/featured');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((item: any) => {
        expect(item.isFeatured).toBe(true);
      });
    });
  });

  describe('GET /v1/destinations/nearby (Geospatial Haversine Calculation)', () => {
    it('should calculate distance and return destinations within radius sorted by distance', async () => {
      // Mandalika Beach / Kuta Lombok Coordinates: Lat -8.892, Lng 116.295
      const response = await request(app).get('/v1/destinations/nearby?lat=-8.892&lng=116.295&radius_km=15');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify distanceKm property exists and is within 15 km
      const nearby = response.body.data;
      nearby.forEach((d: any) => {
        expect(d).toHaveProperty('distanceKm');
        expect(d.distanceKm).toBeLessThanOrEqual(15);
      });

      // Verify sorted by distance ascending
      for (let i = 0; i < nearby.length - 1; i++) {
        expect(nearby[i].distanceKm).toBeLessThanOrEqual(nearby[i + 1].distanceKm);
      }
    });

    it('should fail with 400 when lat/lng coordinates are missing', async () => {
      const response = await request(app).get('/v1/destinations/nearby?radius=10');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /v1/destinations/search', () => {
    it('should search destinations by name/keyword (e.g. Rinjani)', async () => {
      const response = await request(app).get('/v1/destinations/search?q=Rinjani');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      const rinjani = response.body.data.find((d: any) => d.name.includes('Rinjani'));
      expect(rinjani).toBeDefined();
    });

    it('should fail search when query parameter is missing', async () => {
      const response = await request(app).get('/v1/destinations/search');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /v1/destinations/:id (Detail by ID or Slug)', () => {
    it('should return destination detail when queried by UUID', async () => {
      const response = await request(app).get('/v1/destinations/dest_tanjung_aan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('dest_tanjung_aan');
      expect(response.body.data.name).toBe('Pantai Tanjung Aan');
      expect(response.body.data.tags).toContain('Mandalika');
      expect(response.body.data.facilities.length).toBeGreaterThan(0);
      expect(response.body.data.images.length).toBeGreaterThan(0);
    });

    it('should return destination detail when queried by slug', async () => {
      const response = await request(app).get('/v1/destinations/pantai-tanjung-aan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('pantai-tanjung-aan');
      expect(response.body.data.name).toBe('Pantai Tanjung Aan');
    });

    it('should return 404 when destination does not exist', async () => {
      const response = await request(app).get('/v1/destinations/non-existent-destination-xyz');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });
  });

  describe('Destination Favorite Toggle Endpoints (/v1/destinations/:id/favorite)', () => {
    let authToken = '';

    beforeAll(async () => {
      const registerRes = await request(app).post('/v1/auth/register').send({
        name: 'Favorite Tester',
        email: `dest.fav.${Date.now()}@lombokexplorer.com`,
        password: 'Password123!',
      });
      authToken = registerRes.body.data.accessToken;
    });

    it('should reject unauthenticated POST /v1/destinations/:id/favorite (401)', async () => {
      const res = await request(app).post('/v1/destinations/dest_tanjung_aan/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should toggle favorite ON when destination is not favorited yet', async () => {
      const res = await request(app)
        .post('/v1/destinations/dest_tanjung_aan/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(true);
      expect(res.body.data.destinationId).toBe('dest_tanjung_aan');
      expect(res.body.message).toContain('added to favorites');
    });

    it('should get current favorite status as true', async () => {
      const res = await request(app)
        .get('/v1/destinations/dest_tanjung_aan/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(true);
    });

    it('should reflect isFavorite = true in destination detail when authenticated', async () => {
      const res = await request(app)
        .get('/v1/destinations/dest_tanjung_aan')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFavorite).toBe(true);
    });

    it('should toggle favorite OFF when called again on the same destination', async () => {
      const res = await request(app)
        .post('/v1/destinations/dest_tanjung_aan/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(false);
      expect(res.body.message).toContain('removed from favorites');
    });

    it('should get current favorite status as false after toggle OFF', async () => {
      const res = await request(app)
        .get('/v1/destinations/dest_tanjung_aan/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFavorite).toBe(false);
    });

    it('should support toggle by destination slug (e.g. bukit-merese)', async () => {
      const res = await request(app)
        .post('/v1/destinations/bukit-merese/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFavorite).toBe(true);
    });

    it('should explicitly remove favorite using DELETE /v1/destinations/:id/favorite', async () => {
      const res = await request(app)
        .delete('/v1/destinations/bukit-merese/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('removed from favorites');
    });

    it('should return 404 when toggling non-existent destination', async () => {
      const res = await request(app)
        .post('/v1/destinations/non-existent-destination-xyz/favorite')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });
  });
});
