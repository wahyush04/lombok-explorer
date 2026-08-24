import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Packing Checklists API Module (Phase 18)', () => {
  let app: Application;
  let userToken: string;
  let otherUserToken: string;
  let testChecklistId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Login primary traveler
    const res1 = await request(app).post('/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = res1.body.data.accessToken;

    // 2. Register other traveler
    const uniqueEmail = `checklist_tester_${Date.now()}@example.com`;
    const res2 = await request(app).post('/v1/auth/register').send({
      name: 'Checklist Other User',
      email: uniqueEmail,
      password: 'Password123!',
    });
    otherUserToken = res2.body.data.accessToken;
  });

  describe('POST /v1/checklists (Create Packing Checklist)', () => {
    it('should create a new packing checklist with nested items and calculate stats', async () => {
      const response = await request(app)
        .post('/v1/checklists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Perlengkapan Snorkeling & Pantai Gili',
          category: 'BEACH',
          items: [
            { itemText: 'Kacamata Snorkel & Fin', isChecked: true, orderIndex: 0 },
            { itemText: 'Drybag 10L', isChecked: false, orderIndex: 1 },
            { itemText: 'Sunscreen Reef-Safe SPF50', isChecked: false, orderIndex: 2 },
            { itemText: 'GoPro Underwater Housing', isChecked: true, orderIndex: 3 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Perlengkapan Snorkeling & Pantai Gili');
      expect(response.body.data.category).toBe('BEACH');
      expect(response.body.data.items).toHaveLength(4);
      expect(response.body.data.totalItems).toBe(4);
      expect(response.body.data.completedItems).toBe(2);
      expect(response.body.data.completionPercentage).toBe(50);

      testChecklistId = response.body.data.id;
    });

    it('should create an empty checklist with default GENERAL category', async () => {
      const response = await request(app)
        .post('/v1/checklists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'General Packing Essentials',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('GENERAL');
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.completionPercentage).toBe(0);
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app).post('/v1/checklists').send({
        title: 'Unauthenticated checklist',
      });

      expect(response.status).toBe(401);
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/v1/checklists')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/checklists (List Packing Checklists)', () => {
    it('should list all checklists of authenticated user with progress', async () => {
      const response = await request(app)
        .get('/v1/checklists')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data[0]).toHaveProperty('totalItems');
      expect(response.body.data[0]).toHaveProperty('completionPercentage');
    });

    it('should filter checklists by category (BEACH)', async () => {
      const response = await request(app)
        .get('/v1/checklists?category=BEACH')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      for (const item of response.body.data) {
        expect(item.category).toBe('BEACH');
      }
    });
  });

  describe('GET /v1/checklists/:id (Get Checklist Details)', () => {
    it('should return checklist with items ordered by orderIndex', async () => {
      const response = await request(app)
        .get(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testChecklistId);
      expect(response.body.data.items).toHaveLength(4);
    });

    it('should return 403 when another user attempts to view checklist', async () => {
      const response = await request(app)
        .get(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });
  });

  describe('PUT /v1/checklists/:id (Update Checklist & Items)', () => {
    it('should update checklist title and replace items (100% completion)', async () => {
      const response = await request(app)
        .put(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Perlengkapan Snorkeling Gili (All Checked)',
          items: [
            { itemText: 'Kacamata Snorkel & Fin', isChecked: true, orderIndex: 0 },
            { itemText: 'Drybag 10L', isChecked: true, orderIndex: 1 },
            { itemText: 'Sunscreen Reef-Safe SPF50', isChecked: true, orderIndex: 2 },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toContain('All Checked');
      expect(response.body.data.totalItems).toBe(3);
      expect(response.body.data.completedItems).toBe(3);
      expect(response.body.data.completionPercentage).toBe(100);
    });

    it('should return 403 when another user attempts to update checklist', async () => {
      const response = await request(app)
        .put(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Hacked Checklist',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /v1/checklists/:id (Delete Checklist)', () => {
    it('should return 403 when another user attempts to delete checklist', async () => {
      const response = await request(app)
        .delete(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should delete checklist and its nested items successfully by owner', async () => {
      const response = await request(app)
        .delete(`/v1/checklists/${testChecklistId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion in DB
      const check = await prisma.checklist.findUnique({ where: { id: testChecklistId } });
      expect(check).toBeNull();
    });
  });
});
