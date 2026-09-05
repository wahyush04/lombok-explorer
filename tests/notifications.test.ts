import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Notifications API & Read State Management', () => {
  let app: Application;
  let userTokenA: string;
  let userIdA: string;
  let userTokenB: string;
  let userIdB: string;
  let testNotificationIdA: string;
  let testNotificationIdB: string;

  beforeAll(async () => {
    app = createApp();

    // User A
    const loginResA = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });
    userTokenA = loginResA.body.data.accessToken;
    userIdA = loginResA.body.data.user.id;

    // User B
    const emailB = `test.notif.user.${Date.now()}@example.com`;
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `notif_b_${Date.now().toString().slice(-4)}`,
        name: 'User Notif B',
        email: emailB,
        password: 'Password123!',
      });
    userTokenB = regResB.body.data.accessToken;
    userIdB = regResB.body.data.user.id;

    // Seed test notifications
    const notifA = await prisma.notification.create({
      data: {
        recipientId: userIdA,
        actorId: userIdB,
        type: 'POST_LIKED',
        title: 'User Notif B menyukai postingan Anda',
        body: 'Ketuk untuk melihat postingan Anda',
        isRead: false,
      },
    });
    testNotificationIdA = notifA.id;

    const notifB = await prisma.notification.create({
      data: {
        recipientId: userIdB,
        actorId: userIdA,
        type: 'POST_COMMENTED',
        title: 'Traveler mengomentari postingan Anda',
        body: '"Bagus sekali!"',
        isRead: false,
      },
    });
    testNotificationIdB = notifB.id;
  });

  afterAll(async () => {
    if (userIdA && userIdB) {
      await prisma.notification.deleteMany({
        where: {
          OR: [{ recipientId: userIdA }, { recipientId: userIdB }],
        },
      });
      await prisma.user.deleteMany({
        where: { id: userIdB },
      });
    }
  });

  describe('GET /api/v1/notifications', () => {
    it('should fail with 401 if unauthenticated', async () => {
      const res = await request(app).get('/api/v1/notifications').expect(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should return paginated list of notifications for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const item = res.body.data.items[0];
      expect(item.actor).toBeDefined();
      expect(item.actor.id).toBe(userIdB);
      expect(item.type).toBe('POST_LIKED');
    });

    it('should filter only unread notifications when unreadOnly=true', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const notif of res.body.data.items) {
        expect(notif.isRead).toBe(false);
      }
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return unread count for user', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should forbid user from marking another users notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${testNotificationIdB}/read`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should mark own notification as read', async () => {
      const res = await request(app)
        .patch(`/api/v1/notifications/${testNotificationIdA}/read`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testNotificationIdA);
      expect(res.body.data.isRead).toBe(true);

      const record = await prisma.notification.findUnique({
        where: { id: testNotificationIdA },
      });
      expect(record?.isRead).toBe(true);
      expect(record?.readAt).not.toBeNull();
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all unread notifications of user as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userTokenB}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);

      const unreadCountRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${userTokenB}`)
        .expect(200);

      expect(unreadCountRes.body.data.unreadCount).toBe(0);
    });
  });
});
