import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('PostgreSQL Full-Text Search (FTS) & Trigram Similarity Engine', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /v1/destinations/search (Full-Text Search & Fuzzy Matching)', () => {
    it('should successfully find "Bukit Merese" with exact title match and high relevance score', async () => {
      const response = await request(app).get('/v1/destinations/search?q=bukit%20merese&page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.total).toBeGreaterThan(0);

      // Bukit Merese must be the top result
      const topResult = response.body.data[0];
      expect(topResult.name.toLowerCase()).toContain('merese');
      expect(topResult).toHaveProperty('id');
      expect(topResult).toHaveProperty('slug');
      expect(topResult).toHaveProperty('rating');
      expect(topResult).toHaveProperty('categoryName');
      expect(Array.isArray(topResult.tags)).toBe(true);
    });

    it('should find destinations with case-insensitive and partial title matches ("merese")', async () => {
      const response = await request(app).get('/v1/destinations/search?q=MERESE');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const hasMerese = response.body.data.some((d: any) =>
        d.name.toLowerCase().includes('merese'),
      );
      expect(hasMerese).toBe(true);
    });

    it('should support multi-keyword search ("pantai tanjung aan")', async () => {
      const response = await request(app).get('/v1/destinations/search?q=pantai%20tanjung%20aan');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const topResult = response.body.data[0];
      expect(topResult.name.toLowerCase()).toContain('tanjung aan');
    });

    it('should find destinations matching description or tags ("sunset" or "snorkeling")', async () => {
      const response = await request(app).get('/v1/destinations/search?q=sunset&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify that matched items contain "sunset" in name, description, shortDescription, or tags
      const hasSunsetKeyword = response.body.data.some((d: any) => {
        const text = `${d.name} ${d.shortDescription} ${d.description} ${d.tags.join(' ')}`.toLowerCase();
        return text.includes('sunset');
      });
      expect(hasSunsetKeyword).toBe(true);
    });

    it('should perform fuzzy/typo matching using pg_trgm similarity ("bukit merse" -> "Bukit Merese")', async () => {
      const response = await request(app).get('/v1/destinations/search?q=bukit%20merse');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const found = response.body.data.some((d: any) =>
        d.name.toLowerCase().includes('merese'),
      );
      expect(found).toBe(true);
    });

    it('should perform fuzzy matching for "tanjung an" -> "Pantai Tanjung Aan"', async () => {
      const response = await request(app).get('/v1/destinations/search?q=tanjung%20an');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const found = response.body.data.some((d: any) =>
        d.name.toLowerCase().includes('tanjung aan'),
      );
      expect(found).toBe(true);
    });

    it('should rank exact title matches higher than generic description matches', async () => {
      const response = await request(app).get('/v1/destinations/search?q=Rinjani');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Exact/prefix title matches must come before items that only mention Rinjani in description
      const first = response.body.data[0];
      expect(first.name.toLowerCase()).toContain('rinjani');
    });

    it('should combine search with multifaceted filters (region, min_rating, max_price)', async () => {
      const response = await request(app).get(
        '/v1/destinations/search?q=pantai&region=LOMBOK_TENGAH&min_rating=4.0&max_price=50000',
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      response.body.data.forEach((d: any) => {
        expect(d.region).toBe('LOMBOK_TENGAH');
        expect(d.rating).toBeGreaterThanOrEqual(4.0);
        expect(d.entranceFee).toBeLessThanOrEqual(50000);
      });
    });

    it('should return correct pagination metadata on search results', async () => {
      const response = await request(app).get('/v1/destinations/search?q=pantai&page=1&limit=3');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(3);

      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 3,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        currentPage: 1,
        totalCount: expect.any(Number),
      });
      expect(response.body.meta.hasNextPage).toBe(response.body.meta.totalPages > 1);
    });

    it('should validate missing search parameter with Zod schema (400 Bad Request)', async () => {
      const response = await request(app).get('/v1/destinations/search');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      expect(response.body.message).toBeDefined();
    });

    it('should safely handle SQL injection payloads without throwing SQL syntax errors', async () => {
      const maliciousPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE destinations; --",
        "bukit' OR 1=1 --",
        '" OR ""="',
        '\\x00\\x27\\x22',
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app).get(
          `/v1/destinations/search?q=${encodeURIComponent(payload)}`,
        );

        // Expect either 200 with safe results or standard error, NEVER a 500 database crash
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      }
    });
  });

  describe('GET /v1/destinations (with search query parameter)', () => {
    it('should use full-text search when search query parameter is provided on main list endpoint', async () => {
      const response = await request(app).get('/v1/destinations?search=bukit%20merese');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const topResult = response.body.data[0];
      expect(topResult.name.toLowerCase()).toContain('merese');
    });
  });

  describe('GET /v1/feeds/destinations/search (Community Destination Search)', () => {
    it('should find destinations for feed post attachment using FTS and fuzzy relevance', async () => {
      const response = await request(app).get('/v1/feeds/destinations/search?q=merese');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const topResult = response.body.data[0];
      expect(topResult.name.toLowerCase()).toContain('merese');
      expect(topResult).toHaveProperty('id');
      expect(topResult).toHaveProperty('name');
      expect(topResult).toHaveProperty('slug');
      expect(topResult).toHaveProperty('latitude');
      expect(topResult).toHaveProperty('longitude');
    });
  });
});
