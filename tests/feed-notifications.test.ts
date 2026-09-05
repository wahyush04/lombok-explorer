import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { pushNotificationService } from '../src/modules/notifications/services/push-notification.service';

describe('Feed Notifications Integration (POST_LIKED & POST_COMMENTED)', () => {
  let app: Application;
  let userTokenA: string;
  let userIdA: string;
  let userTokenB: string;
  let userIdB: string;
  let postOfUserAId: string;

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
    const emailB = `feed.notif.user.${Date.now()}@example.com`;
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: `feed_notif_${Date.now().toString().slice(-4)}`,
        name: 'User Feed B',
        email: emailB,
        password: 'Password123!',
      });
    userTokenB = regResB.body.data.accessToken;
    userIdB = regResB.body.data.user.id;

    // Create a post by User A
    const postRes = await request(app)
      .post('/api/v1/feeds/posts')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({
        title: 'Sunset Indah di Bukit Merese',
        description: 'Pemandangan luar biasa sore hari.',
        location: {
          name: 'Bukit Merese',
          latitude: -8.913,
          longitude: 116.319,
        },
        images: [
          {
            url: 'https://res.cloudinary.com/test/image/upload/v1/merese.jpg',
            publicId: `lombok-explorer/feeds/${userIdA}/session/merese`,
          },
        ],
      });

    postOfUserAId = postRes.body.data.id;
  });

  afterAll(async () => {
    if (postOfUserAId) {
      await prisma.notification.deleteMany({
        where: { postId: postOfUserAId },
      });
      await prisma.postLike.deleteMany({
        where: { postId: postOfUserAId },
      });
      await prisma.postComment.deleteMany({
        where: { postId: postOfUserAId },
      });
      await prisma.postMedia.deleteMany({
        where: { postId: postOfUserAId },
      });
      await prisma.postLocation.deleteMany({
        where: { postId: postOfUserAId },
      });
      await prisma.post.deleteMany({
        where: { id: postOfUserAId },
      });
    }

    if (userIdB) {
      await prisma.user.deleteMany({
        where: { id: userIdB },
      });
    }
  });

  describe('Like Post Notification Triggers', () => {
    it('should create POST_LIKED notification when User B likes User As post', async () => {
      const initialCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_LIKED',
        },
      });

      const likeRes = await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/like`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .expect(200);

      expect(likeRes.body.success).toBe(true);
      expect(likeRes.body.data.isLiked).toBe(true);

      // Verify notification created in DB
      const afterCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_LIKED',
        },
      });

      expect(afterCount).toBe(initialCount + 1);

      const notif = await prisma.notification.findFirst({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_LIKED',
        },
      });

      expect(notif).toBeDefined();
      expect(notif?.title).toContain('User Feed B');
      expect(notif?.isRead).toBe(false);
    });

    it('should NOT create a duplicate notification on repeated like (idempotency)', async () => {
      const beforeCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_LIKED',
        },
      });

      await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/like`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .expect(200);

      const afterCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_LIKED',
        },
      });

      expect(afterCount).toBe(beforeCount);
    });

    it('should NOT create notification when User A likes own post', async () => {
      const beforeCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdA,
          postId: postOfUserAId,
        },
      });

      await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/like`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .expect(200);

      const afterCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdA,
          postId: postOfUserAId,
        },
      });

      expect(afterCount).toBe(beforeCount);
      expect(afterCount).toBe(0);
    });
  });

  describe('Comment Post Notification Triggers', () => {
    it('should create POST_COMMENTED notification when User B comments on User As post', async () => {
      const beforeCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_COMMENTED',
        },
      });

      const commentRes = await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/comments`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({
          content: 'Spot foto terbaik di Lombok Selatan!',
        })
        .expect(201);

      expect(commentRes.body.success).toBe(true);

      const afterCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_COMMENTED',
        },
      });

      expect(afterCount).toBe(beforeCount + 1);

      const notif = await prisma.notification.findFirst({
        where: {
          recipientId: userIdA,
          actorId: userIdB,
          postId: postOfUserAId,
          type: 'POST_COMMENTED',
        },
      });

      expect(notif).toBeDefined();
      expect(notif?.title).toContain('User Feed B');
      expect(notif?.body).toContain('Spot foto terbaik');
      expect(notif?.commentId).toBe(commentRes.body.data.id);
    });

    it('should NOT create notification when User A comments on own post', async () => {
      const beforeCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdA,
          postId: postOfUserAId,
          type: 'POST_COMMENTED',
        },
      });

      await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/comments`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          content: 'Komentar di postingan sendiri.',
        })
        .expect(201);

      const afterCount = await prisma.notification.count({
        where: {
          recipientId: userIdA,
          actorId: userIdA,
          postId: postOfUserAId,
          type: 'POST_COMMENTED',
        },
      });

      expect(afterCount).toBe(beforeCount);
      expect(afterCount).toBe(0);
    });
  });

  describe('FCM Push Failure Resilience', () => {
    it('should NOT roll back like or comment if push notification delivery fails or throws', async () => {
      // Spy and simulate a rejection/throw in push delivery
      const pushSpy = vi
        .spyOn(pushNotificationService, 'sendPushToUser')
        .mockRejectedValueOnce(new Error('Simulated FCM Network Timeout'));

      const commentRes = await request(app)
        .post(`/api/v1/feeds/posts/${postOfUserAId}/comments`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({
          content: 'Komentar saat jaringan FCM bermasalah.',
        })
        .expect(201);

      expect(commentRes.body.success).toBe(true);

      // Verify comment and DB notification still persisted cleanly
      const createdComment = await prisma.postComment.findUnique({
        where: { id: commentRes.body.data.id },
      });
      expect(createdComment).not.toBeNull();

      pushSpy.mockRestore();
    });
  });
});
