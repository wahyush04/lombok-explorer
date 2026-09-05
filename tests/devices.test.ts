import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Device Tokens & FCM Registration API', () => {
  let app: Application;
  let userToken: string;
  let userId: string;
  const testFcmToken = `fcm_test_token_${Date.now()}`;

  beforeAll(async () => {
    app = createApp();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });
    userToken = loginRes.body.data.accessToken;
    userId = loginRes.body.data.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.deviceToken.deleteMany({
        where: { userId },
      });
    }
  });

  describe('POST /api/v1/devices/fcm-token', () => {
    it('should fail with 401 Unauthorized if token is missing', async () => {
      const res = await request(app)
        .post('/api/v1/devices/fcm-token')
        .send({
          token: testFcmToken,
          platform: 'ANDROID',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 400 Validation Error if token field is empty', async () => {
      const res = await request(app)
        .post('/api/v1/devices/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: '',
          platform: 'ANDROID',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should register a new FCM device token successfully', async () => {
      const res = await request(app)
        .post('/api/v1/devices/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: testFcmToken,
          platform: 'ANDROID',
          deviceId: 'pixel-7-pro',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe(testFcmToken);
      expect(res.body.data.platform).toBe('ANDROID');
      expect(res.body.data.deviceId).toBe('pixel-7-pro');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.userId).toBe(userId);
    });

    it('should support token refresh / upsert for the same token without duplication', async () => {
      const res = await request(app)
        .post('/api/v1/devices/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: testFcmToken,
          platform: 'ANDROID',
          deviceId: 'pixel-7-pro-updated',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceId).toBe('pixel-7-pro-updated');
      expect(res.body.data.isActive).toBe(true);

      const count = await prisma.deviceToken.count({
        where: { token: testFcmToken },
      });
      expect(count).toBe(1);
    });
  });

  describe('DELETE /api/v1/devices/fcm-token', () => {
    it('should deactivate device token on logout/disable', async () => {
      const res = await request(app)
        .delete('/api/v1/devices/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          token: testFcmToken,
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const record = await prisma.deviceToken.findUnique({
        where: { token: testFcmToken },
      });
      expect(record?.isActive).toBe(false);
    });
  });
});
