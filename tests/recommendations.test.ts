import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import {
  aiRecommendationService,
  ruleBasedRecommendationService,
} from '../src/modules/recommendations/services';
import { recommendationsService } from '../src/modules/recommendations/recommendations.service';
import { RecommendationItemDto } from '../src/modules/recommendations/dto/recommendation.dto';

describe('Recommendations Engine API Module (Phase 15)', () => {
  let app: Application;
  let userToken = '';

  const user = {
    name: 'Recommendation Traveler Rina',
    email: `rina.recom.${Date.now()}@lombokexplorer.com`,
    password: 'PasswordRec123!',
  };

  beforeAll(async () => {
    app = createApp();

    // 1. Register User
    const res = await request(app).post('/v1/auth/register').send(user);
    userToken = res.body.data.accessToken;

    // 2. Add some favorites to personalize user profile (e.g. Pantai Tanjung Aan)
    await request(app)
      .post('/v1/favorites/dest_tanjung_aan')
      .set('Authorization', `Bearer ${userToken}`);
  });

  describe('GET /v1/recommendations (General & Rule-Based Recommendation)', () => {
    it('should return top recommendations for guest visitors', async () => {
      const response = await request(app).get('/v1/recommendations?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('meta');

      const items = response.body.data.recommendations;
      expect(items.length).toBeLessThanOrEqual(5);
      expect(items.length).toBeGreaterThan(0);

      // Verify recommendation item structure
      items.forEach((item: RecommendationItemDto) => {
        expect(item).toHaveProperty('destination');
        expect(item).toHaveProperty('score');
        expect(item).toHaveProperty('matchReasons');
        expect(Array.isArray(item.matchReasons)).toBe(true);
        expect(item.matchReasons.length).toBeGreaterThan(0);
      });

      expect(response.body.data.meta.engine).toBe('RuleBasedRecommendationEngine');
      expect(response.body.data.meta.personalized).toBe(false);
    });

    it('should prioritize beach and gili destinations when travel_style=BEACH_RELAXATION', async () => {
      const response = await request(app).get(
        '/v1/recommendations?travel_style=BEACH_RELAXATION&limit=4',
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const items = response.body.data.recommendations;
      const topCat = items[0].destination.categorySlug.toLowerCase();
      expect(['beach', 'gili', 'snorkeling', 'sunset']).toContain(topCat);
      expect(
        items.some((item: RecommendationItemDto) =>
          item.matchReasons.some((r) => r.toLowerCase().includes('pantai') || r.toLowerCase().includes('relaksasi')),
        ),
      ).toBe(true);
    });

    it('should prioritize nature and adventure destinations when travel_style=NATURE_ADVENTURE', async () => {
      const response = await request(app).get(
        '/v1/recommendations?travel_style=NATURE_ADVENTURE&limit=4',
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const items = response.body.data.recommendations;
      const topCat = items[0].destination.categorySlug.toLowerCase();
      expect(['waterfall', 'mountain', 'hill', 'adventure']).toContain(topCat);
    });

    it('should calculate distance and prioritize nearby destinations when coordinates are provided', async () => {
      // Near Kuta Mandalika (Latitude: -8.892, Longitude: 116.295)
      const response = await request(app).get(
        '/v1/recommendations?latitude=-8.892&longitude=116.295&radius_km=30&limit=4',
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const items = response.body.data.recommendations;
      expect(items.length).toBeGreaterThan(0);

      // Destination closest to Mandalika should have distanceKm populated
      expect(items[0]).toHaveProperty('distanceKm');
      expect(typeof items[0].distanceKm).toBe('number');
      expect(items[0].distanceKm).toBeLessThan(30);
    });

    it('should return personalized recommendations with affinity boost for authenticated user', async () => {
      const response = await request(app)
        .get('/v1/recommendations?limit=6')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.meta.personalized).toBe(true);

      const items = response.body.data.recommendations;
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('Engine Abstraction & Hot-Swapping (RuleBased vs AI)', () => {
    it('should dynamically switch between RuleBased and AI recommendation engines', async () => {
      // Switch to AI recommendation engine
      recommendationsService.setEngine(aiRecommendationService);
      expect(recommendationsService.getActiveEngineName()).toBe('AIRecommendationEngine');

      const responseAI = await request(app).get('/v1/recommendations?limit=3');
      expect(responseAI.status).toBe(200);
      expect(responseAI.body.data.meta.engine).toBe('AIRecommendationEngine');
      expect(
        responseAI.body.data.recommendations[0].matchReasons.some((r: string) =>
          r.includes('[AI Curated]'),
        ),
      ).toBe(true);

      // Switch back to Rule-based engine
      recommendationsService.setEngine(ruleBasedRecommendationService);
      expect(recommendationsService.getActiveEngineName()).toBe('RuleBasedRecommendationEngine');

      const responseRule = await request(app).get('/v1/recommendations?limit=3');
      expect(responseRule.status).toBe(200);
      expect(responseRule.body.data.meta.engine).toBe('RuleBasedRecommendationEngine');
    });
  });
});
