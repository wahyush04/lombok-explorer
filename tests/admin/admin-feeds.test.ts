import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { prisma } from '../../src/database/prisma';

describe('Admin Feeds Moderation API Suite (Phase 10)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let testPostId = '';
  let testReportId = '';

  beforeAll(async () => {
    app = createApp();

    // 1. Login as Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Login as Standard User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 3. Create a test post by user
    const postRes = await request(app)
      .post('/api/v1/feeds/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Post for Admin Moderation Test',
        description: 'Testing moderation features.',
        destinationId: 'dest_bukit_merese',
      });
    testPostId = postRes.body.data.id;

    // 4. Submit a report on this post by admin (acting as another reporter)
    const reportRes = await request(app)
      .post(`/api/v1/feeds/posts/${testPostId}/report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'SPAM',
        description: 'Suspected spam content for admin testing.',
      });
    testReportId = reportRes.body.data.id;
  });

  describe('GET /api/v1/admin/feeds/reports', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/admin/feeds/reports');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/feeds/reports')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return paginated list of reports for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/feeds/reports?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });

      const found = res.body.data.find((r: { id: string }) => r.id === testReportId);
      expect(found).toBeDefined();
      expect(found.reason).toBe('SPAM');
      expect(found.status).toBe('PENDING');
    });

    it('should filter reports by status and reason', async () => {
      const res = await request(app)
        .get('/api/v1/admin/feeds/reports?status=PENDING&reason=SPAM')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const item of res.body.data) {
        expect(item.status).toBe('PENDING');
        expect(item.reason).toBe('SPAM');
      }
    });
  });

  describe('GET /api/v1/admin/feeds/reports/:id', () => {
    it('should return 404 for non-existent report ID', async () => {
      const res = await request(app)
        .get('/api/v1/admin/feeds/reports/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('REPORT_NOT_FOUND');
    });

    it('should return complete report details with post and reporter for valid ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/feeds/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: testReportId,
        postId: testPostId,
        reason: 'SPAM',
        status: 'PENDING',
        post: expect.objectContaining({
          id: testPostId,
          title: 'Post for Admin Moderation Test',
        }),
        reporter: expect.objectContaining({
          name: expect.any(String),
        }),
      });
    });
  });

  describe('PATCH /api/v1/admin/feeds/reports/:id', () => {
    it('should reject invalid report status with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/feeds/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should update report status to RESOLVED and record adminNotes', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/feeds/reports/${testReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          adminNotes: 'Content reviewed and marked resolved by admin.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.adminNotes).toBe('Content reviewed and marked resolved by admin.');
      expect(res.body.data.resolvedAt).toBeDefined();
    });
  });

  describe('PATCH /api/v1/admin/feeds/posts/:id/status', () => {
    it('should reject invalid post status with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/feeds/posts/${testPostId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNKNOWN_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should moderate post status to HIDDEN', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/feeds/posts/${testPostId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'HIDDEN',
          adminNotes: 'Hidden temporarily due to reports.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('HIDDEN');

      // Verify public detail endpoint cannot find hidden post
      const publicRes = await request(app)
        .get(`/api/v1/feeds/posts/${testPostId}`);
      expect(publicRes.status).toBe(404);
    });

    it('should restore post status to PUBLISHED', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/feeds/posts/${testPostId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PUBLISHED',
          adminNotes: 'Restored after false alarm.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PUBLISHED');

      // Verify public detail endpoint can view it again
      const publicRes = await request(app)
        .get(`/api/v1/feeds/posts/${testPostId}`);
      expect(publicRes.status).toBe(200);
    });
  });
});
