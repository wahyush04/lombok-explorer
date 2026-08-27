import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Reviews API Module (Phase 11)', () => {
  let app: Application;
  let userTokenA = '';
  let userTokenB = '';
  let createdReviewId = '';
  let userA: { username: string; name: string; email: string; password: string };
  let userB: { username: string; name: string; email: string; password: string };

  beforeAll(async () => {
    app = createApp();

    const suffix = `${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;
    userA = {
      username: `rev_satria_${suffix}`,
      name: 'Reviewer Satria',
      email: `satria.rev.${suffix}@lombokexplorer.com`,
      password: 'PasswordReview123!',
    };

    const userB = {
      username: `rev_dian_${suffix}`,
      name: 'Reviewer Dian',
      email: `dian.rev.${suffix}@lombokexplorer.com`,
      password: 'PasswordReview123!',
    };

    // Register User A
    const resA = await request(app).post('/v1/auth/register').send(userA);
    userTokenA = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post('/v1/auth/register').send(userB);
    userTokenB = resB.body.data.accessToken;
  });

  describe('GET /v1/destinations/:id/reviews (List Reviews)', () => {
    it('should return paginated reviews for a valid destination slug', async () => {
      const response = await request(app).get('/v1/destinations/pantai-tanjung-aan/reviews?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });

      if (response.body.data.length > 0) {
        const rev = response.body.data[0];
        expect(rev).toHaveProperty('id');
        expect(rev).toHaveProperty('rating');
        expect(rev).toHaveProperty('content');
        expect(rev).toHaveProperty('user');
        expect(rev.user).toHaveProperty('name');
      }
    });

    it('should return 404 for a non-existent destination', async () => {
      const response = await request(app).get('/v1/destinations/non-existent-destination-slug/reviews');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });
  });

  describe('POST /v1/destinations/:id/reviews (Create Review)', () => {
    it('should reject unauthenticated review submissions (401 Unauthorized)', async () => {
      const response = await request(app)
        .post('/v1/destinations/pantai-tanjung-aan/reviews')
        .send({ rating: 5, content: 'Pantai yang luar biasa indah!' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject review with invalid rating outside 1-5 range (400 Bad Request)', async () => {
      const response = await request(app)
        .post('/v1/destinations/pantai-tanjung-aan/reviews')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ rating: 6, content: 'Nilai rating tidak valid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should create a review successfully and recalculate destination rating', async () => {
      // Check initial destination rating & review count
      const initialDestRes = await request(app).get('/v1/destinations/pantai-tanjung-aan');
      const initialCount = initialDestRes.body.data.reviewCount;

      const response = await request(app)
        .post('/v1/destinations/pantai-tanjung-aan/reviews')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          rating: 5,
          content: 'Pantai dengan pasir merica terbaik di dunia! Airnya sangat jernih dan tenang.',
          photos: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e'],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.content).toContain('pasir merica');
      expect(response.body.data.photos.length).toBe(1);
      expect(response.body.data.user.name).toBe(userA.name);

      createdReviewId = response.body.data.id;

      // Verify destination reviewCount and rating are recalculated
      const updatedDestRes = await request(app).get('/v1/destinations/pantai-tanjung-aan');
      expect(updatedDestRes.body.data.reviewCount).toBeGreaterThanOrEqual(1);
      expect(updatedDestRes.body.data.rating).toBeGreaterThanOrEqual(4.0);
    });
  });

  describe('PUT /v1/reviews/:id (Update Review & Ownership Enforcement)', () => {
    it('should reject review update from non-owner (403 Forbidden)', async () => {
      const response = await request(app)
        .put(`/v1/reviews/${createdReviewId}`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ rating: 2, content: 'Percobaan ubah review orang lain' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should update review when requested by the review owner', async () => {
      const response = await request(app)
        .put(`/v1/reviews/${createdReviewId}`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          rating: 4,
          content: 'Updated: Pemandangannya indah, tapi parkir cukup ramai saat weekend.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(4);
      expect(response.body.data.content).toContain('Updated:');
    });

    it('should return 404 when updating non-existent review', async () => {
      const response = await request(app)
        .put('/v1/reviews/non-existent-review-id-999')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ rating: 4 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('REVIEW_NOT_FOUND');
    });
  });

  describe('DELETE /v1/reviews/:id (Delete Review & Ownership Enforcement)', () => {
    it('should reject review deletion from non-owner (403 Forbidden)', async () => {
      const response = await request(app)
        .delete(`/v1/reviews/${createdReviewId}`)
        .set('Authorization', `Bearer ${userTokenB}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should delete review when requested by the review owner', async () => {
      const response = await request(app)
        .delete(`/v1/reviews/${createdReviewId}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Subsequent delete should return 404
      const retryDelete = await request(app)
        .delete(`/v1/reviews/${createdReviewId}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(retryDelete.status).toBe(404);
      expect(retryDelete.body.errorCode).toBe('REVIEW_NOT_FOUND');
    });
  });
});
