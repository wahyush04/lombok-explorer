import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Favorites API Module (Phase 10)', () => {
  let app: Application;
  let userToken = '';
  let otherUserToken = '';

  beforeAll(async () => {
    app = createApp();

    const suffix = `${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;
    const userA = {
      username: `fav_a_${suffix}`,
      name: 'Andi Pratama',
      email: `andi.fav.${suffix}@lombokexplorer.com`,
      password: 'PasswordFavorit123!',
    };

    const userB = {
      username: `fav_b_${suffix}`,
      name: 'Bella Safitri',
      email: `bella.fav.${suffix}@lombokexplorer.com`,
      password: 'PasswordFavorit123!',
    };

    // Register User A
    const resA = await request(app).post('/v1/auth/register').send(userA);
    userToken = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post('/v1/auth/register').send(userB);
    otherUserToken = resB.body.data.accessToken;
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated requests to GET /v1/favorites (401 Unauthorized)', async () => {
      const response = await request(app).get('/v1/favorites');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });
  });

  describe('POST /v1/favorites/:destinationId (Add Favorite)', () => {
    it('should add destination to favorites using destination ID', async () => {
      const response = await request(app)
        .post('/v1/favorites/dest_tanjung_aan')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added to favorites');
      expect(response.body.data.id).toBe('dest_tanjung_aan');
      expect(response.body.data.isFavorite).toBe(true);
    });

    it('should add destination to favorites using destination slug', async () => {
      const response = await request(app)
        .post('/v1/favorites/bukit-merese')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('bukit-merese');
    });

    it('should reject duplicate favorite addition (409 Conflict)', async () => {
      const response = await request(app)
        .post('/v1/favorites/dest_tanjung_aan')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DUPLICATE_FAVORITE');
    });

    it('should return 404 when adding a non-existent destination', async () => {
      const response = await request(app)
        .post('/v1/favorites/non-existent-destination-uuid')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });
  });

  describe('GET /v1/favorites (List User Favorites)', () => {
    it('should return only the authenticated user favorites', async () => {
      const response = await request(app)
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.meta.total).toBe(2);

      const slugs = response.body.data.map((d: any) => d.slug);
      expect(slugs).toContain('pantai-tanjung-aan');
      expect(slugs).toContain('bukit-merese');
    });

    it('should maintain user isolation — User B should have 0 favorites initially', async () => {
      const response = await request(app)
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(0);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('DELETE /v1/favorites/:destinationId (Remove Favorite)', () => {
    it('should remove destination from favorites successfully', async () => {
      const response = await request(app)
        .delete('/v1/favorites/dest_tanjung_aan')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed from favorites');

      // Verify list now has 1 item
      const listRes = await request(app)
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${userToken}`);

      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].slug).toBe('bukit-merese');
    });

    it('should return 404 when removing a destination that is not favorited', async () => {
      const response = await request(app)
        .delete('/v1/favorites/dest_tanjung_aan')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FAVORITE_NOT_FOUND');
    });
  });
});
