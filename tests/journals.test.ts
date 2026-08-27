import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Travel Journals API Module (Phase 18)', () => {
  let app: Application;
  let userToken: string;
  let otherUserToken: string;
  let testJournalId: string;
  let testPrivateJournalId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Login primary traveler
    const res1 = await request(app).post('/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = res1.body.data.accessToken;

    // 2. Register other traveler
    const uniqueEmail = `journal_tester_${Date.now()}@example.com`;
    const res2 = await request(app).post('/v1/auth/register').send({
      username: `journal_other_${Date.now().toString().slice(-4)}`,
      name: 'Journal Other User',
      email: uniqueEmail,
      password: 'Password123!',
    });
    otherUserToken = res2.body.data.accessToken;
  });

  describe('POST /v1/journals (Create Travel Journal)', () => {
    it('should create a new public travel journal successfully', async () => {
      const response = await request(app)
        .post('/v1/journals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Sunset Magic at Bukit Merese',
          content: 'The golden hour from top of Bukit Merese overlooking Tanjung Aan was breathtaking.',
          locationName: 'Bukit Merese, Kuta Lombok',
          date: '2026-08-20',
          photos: ['https://images.unsplash.com/photo-merese-1.jpg'],
          isPublic: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Sunset Magic at Bukit Merese');
      expect(response.body.data.photos).toHaveLength(1);
      expect(response.body.data.isPublic).toBe(true);

      testJournalId = response.body.data.id;
    });

    it('should create a private travel journal entry', async () => {
      const response = await request(app)
        .post('/v1/journals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Private Journal: Rinjani Preparation Thoughts',
          content: 'Packing checklist ready. Preparing mental fortitude for the 3726m summit push.',
          locationName: 'Senaru Village',
          isPublic: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isPublic).toBe(false);

      testPrivateJournalId = response.body.data.id;
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app).post('/v1/journals').send({
        title: 'Unauthenticated note',
        content: 'Should fail',
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 when title or content is missing', async () => {
      const response = await request(app)
        .post('/v1/journals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: '',
          content: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/journals (List Travel Journals)', () => {
    it('should list all journals of authenticated user', async () => {
      const response = await request(app)
        .get('/v1/journals?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should filter journals by search keyword', async () => {
      const response = await request(app)
        .get('/v1/journals?search=Merese')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].title).toContain('Merese');
    });
  });

  describe('GET /v1/journals/:id (Get Travel Journal Details)', () => {
    it('should return journal details for owner', async () => {
      const response = await request(app)
        .get(`/v1/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testJournalId);
      expect(response.body.data.title).toBe('Sunset Magic at Bukit Merese');
    });

    it('should return 403 when another user attempts to view private journal', async () => {
      const response = await request(app)
        .get(`/v1/journals/${testPrivateJournalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('PUT /v1/journals/:id (Update Travel Journal)', () => {
    it('should update journal title and content by owner', async () => {
      const response = await request(app)
        .put(`/v1/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Sunset & Drone Flying at Bukit Merese',
          content: 'Updated content with drone flight notes.',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Sunset & Drone Flying at Bukit Merese');
    });

    it('should return 403 when another user attempts to update journal', async () => {
      const response = await request(app)
        .put(`/v1/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Hijacked Title',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /v1/journals/:id (Delete Travel Journal)', () => {
    it('should return 403 when another user attempts to delete journal', async () => {
      const response = await request(app)
        .delete(`/v1/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should soft delete journal successfully by owner', async () => {
      const response = await request(app)
        .delete(`/v1/journals/${testJournalId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft deleted in DB
      const dbCheck = await prisma.travelJournal.findUnique({ where: { id: testJournalId } });
      expect(dbCheck?.deletedAt).not.toBeNull();
    });
  });
});
