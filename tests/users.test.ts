import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('User Module & Public Identity Suite (Username, Profile, Feeds Author)', () => {
  let app: Application;
  const testSuffix = Date.now().toString().slice(-6);

  const testUserA = {
    username: `user_alpha_${testSuffix}`,
    name: 'Alpha Traveler',
    email: `alpha_${testSuffix}@example.com`,
    password: 'PasswordAlpha123!',
    travelStyle: 'BEACH_RELAXATION',
    preferredRegion: 'LOMBOK_SELATAN',
  };

  const testUserB = {
    username: `user_beta_${testSuffix}`,
    name: 'Beta Adventurer',
    email: `beta_${testSuffix}@example.com`,
    password: 'PasswordBeta123!',
    travelStyle: 'NATURE_ADVENTURE',
    preferredRegion: 'LOMBOK_UTARA',
  };

  let tokenA = '';
  let userIdA = '';
  let tokenB = '';
  let userIdB = '';

  beforeAll(async () => {
    app = createApp();

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send(testUserA);
    expect(resA.status).toBe(201);
    tokenA = resA.body.data.accessToken;
    userIdA = resA.body.data.user.id;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send(testUserB);
    expect(resB.status).toBe(201);
    tokenB = resB.body.data.accessToken;
    userIdB = resB.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.post.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userIdA, userIdB] } },
    });
  });

  describe('1. Username Availability Check (GET /api/v1/users/username/check)', () => {
    it('should return available: true for an untaken valid username', async () => {
      const freeUsername = `free_user_${Date.now().toString().slice(-6)}`;
      const res = await request(app).get(`/api/v1/users/username/check?username=${freeUsername}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe(freeUsername);
      expect(res.body.data.available).toBe(true);
    });

    it('should return available: false with reason TAKEN for an existing username (case-insensitive)', async () => {
      // Check in UPPERCASE
      const res = await request(app).get(
        `/api/v1/users/username/check?username=${testUserA.username.toUpperCase()}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe(testUserA.username.toLowerCase());
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toBe('TAKEN');
    });

    it('should return available: false with reason RESERVED for reserved usernames', async () => {
      const res = await request(app).get('/api/v1/users/username/check?username=admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toBe('RESERVED');
    });

    it('should reject invalid username format with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/users/username/check?username=ab'); // too short (<3)

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject username with spaces or invalid symbols with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/users/username/check?username=invalid%20name!');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Registration Validation & Case-Insensitive Uniqueness', () => {
    it('should reject registration when username is reserved word', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        username: 'official',
        name: 'Official Team',
        email: `official_${Date.now()}@example.com`,
        password: 'Password123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate username registration with 409 USERNAME_ALREADY_EXISTS (case-insensitive)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        username: testUserA.username.toUpperCase(),
        name: 'Duplicate Alpha',
        email: `different_alpha_${Date.now()}@example.com`,
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('USERNAME_ALREADY_EXISTS');
    });
  });

  describe('3. Dual Identifier Login (Email OR Username)', () => {
    it('should authenticate user using email as identifier', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.email,
        password: testUserA.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(userIdA);
      expect(res.body.data.user.username).toBe(testUserA.username.toLowerCase());
    });

    it('should authenticate user using username as identifier', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.username,
        password: testUserA.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(userIdA);
      expect(res.body.data.user.username).toBe(testUserA.username.toLowerCase());
    });

    it('should authenticate user using uppercase username (case-insensitive resolution)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.username.toUpperCase(),
        password: testUserA.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(userIdA);
    });
  });

  describe('4. Authenticated User Profile (GET /api/v1/users/me)', () => {
    it('should reject unauthenticated request with 401 TOKEN_MISSING', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should return complete user profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', userIdA);
      expect(res.body.data).toHaveProperty('username', testUserA.username.toLowerCase());
      expect(res.body.data).toHaveProperty('email', testUserA.email.toLowerCase());
      expect(res.body.data).toHaveProperty('name', testUserA.name);
      expect(res.body.data).toHaveProperty('travelStyle', testUserA.travelStyle);
      expect(res.body.data).toHaveProperty('preferredRegion', testUserA.preferredRegion);
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('refreshToken');
    });
  });

  describe('5. Profile Update (PATCH /api/v1/users/me)', () => {
    it('should update user profile bio, name, and travel preferences', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Alpha Updated Name',
          phone: '+6281234567890',
          travelStyle: 'CULTURE_HERITAGE',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alpha Updated Name');
      expect(res.body.data.phone).toBe('+6281234567890');
      expect(res.body.data.travelStyle).toBe('CULTURE_HERITAGE');
    });

    it('should update username successfully when changing to a new available username', async () => {
      const newUsername = `alpha_new_${Date.now().toString().slice(-6)}`;
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: newUsername,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe(newUsername);

      // Verify in DB
      const updatedUser = await prisma.user.findUnique({ where: { id: userIdA } });
      expect(updatedUser?.username).toBe(newUsername);

      // Revert username back for subsequent tests
      await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: testUserA.username,
        });
    });

    it('should reject username update if username is already taken by another user (409 USERNAME_ALREADY_EXISTS)', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: testUserB.username,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('USERNAME_ALREADY_EXISTS');
    });

    it('should reject username update with invalid characters or reserved word', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: 'system',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('6. Public User Feeds & Author Privacy (GET /api/v1/users/:userId/posts)', () => {
    let postId = '';

    beforeAll(async () => {
      // Create a post by User A
      const postRes = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Pantai Tanjung Aan Bersama Alpha',
          description: 'Air laut jernih seperti kristal dan pasir merica yang unik.',
          destinationId: 'dest_tanjung_aan',
          media: [
            {
              url: 'https://images.unsplash.com/photo-tanjung-aan.jpg',
              type: 'IMAGE',
              sortOrder: 0,
            },
          ],
        });

      if (postRes.status === 201) {
        postId = postRes.body.data.id;
      }
    });

    it('should return posts authored by specific user with author username and NO email exposed', async () => {
      const res = await request(app).get(`/api/v1/users/${userIdA}/posts?limit=10`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);

      if (res.body.data.items.length > 0) {
        const post = res.body.data.items[0];
        expect(post.author.id).toBe(userIdA);
        expect(post.author.username).toBe(testUserA.username.toLowerCase());
        expect(post.author).not.toHaveProperty('email');
      }
    });

    it('should return empty items array when user has no posts', async () => {
      const res = await request(app).get(`/api/v1/users/${userIdB}/posts?limit=10`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('should return 404 NOT_FOUND for non-existent userId', async () => {
      const res = await request(app).get('/api/v1/users/user_non_existent_99999/posts');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('USER_NOT_FOUND');
    });
  });
});
