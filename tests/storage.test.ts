import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import fs from 'fs';
import { createApp } from '../src/app';
import { storageService } from '../src/modules/storage/storage.service';
import {
  cloudStorageProvider,
  cloudinaryStorageProvider,
  localStorageProvider,
} from '../src/modules/storage/providers';

describe('Storage & Media Upload API Module (Cloudinary Storage)', () => {
  let app: Application;
  let userToken: string;
  let uploadedFileUrl: string;
  let uploadedFilePath: string;

  const testImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ); // 1x1 Transparent PNG

  beforeAll(async () => {
    app = createApp();

    // Login traveler
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    // Reset to default provider
    storageService.setProvider(localStorageProvider);

    // Clean up test file if it exists
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      await fs.promises.unlink(uploadedFilePath).catch(() => {});
    }
  });

  describe('Storage Service Provider Switching & Optimizations', () => {
    it('should allow hot-swapping between LocalStorage, CloudStorage, and Cloudinary providers', async () => {
      storageService.setProvider(localStorageProvider);
      expect(storageService.getActiveProviderName()).toBe('LocalStorage');

      storageService.setProvider(cloudStorageProvider);
      expect(storageService.getActiveProviderName()).toBe('CloudStorage');

      storageService.setProvider(cloudinaryStorageProvider);
      expect(storageService.getActiveProviderName()).toBe('Cloudinary');
    });

    it('should generate optimized variant URLs on Cloudinary provider', () => {
      const publicId = 'lombok-explorer/destinations/merese-hills';
      const originalUrl = cloudinaryStorageProvider.generateOptimizedUrl(publicId, 'original');
      const thumbUrl = cloudinaryStorageProvider.generateOptimizedUrl(publicId, 'thumbnail');
      const cardUrl = cloudinaryStorageProvider.generateOptimizedUrl(publicId, 'card');
      const coverUrl = cloudinaryStorageProvider.generateOptimizedUrl(publicId, 'cover');

      expect(originalUrl).toContain(publicId);
      expect(thumbUrl).toContain('w_200');
      expect(cardUrl).toContain('w_600');
      expect(coverUrl).toContain('w_1200');
    });

    it('should extract public ID correctly from full Cloudinary URLs', () => {
      const url = 'https://res.cloudinary.com/tzccdgab/image/upload/v1725000000/lombok-explorer/destinations/kuta-beach.jpg';
      const extracted = cloudinaryStorageProvider.extractPublicId(url);
      expect(extracted).toBe('lombok-explorer/destinations/kuta-beach');
    });
  });

  describe('POST /api/v1/media/images & /api/v1/storage/upload (Single Image Upload)', () => {
    beforeAll(() => {
      storageService.setProvider(localStorageProvider);
    });

    it('should upload a single image via /api/v1/media/images', async () => {
      const response = await request(app)
        .post('/api/v1/media/images')
        .set('Authorization', `Bearer ${userToken}`)
        .field('type', 'DESTINATION')
        .attach('file', testImageBuffer, 'test_beach_merese.png');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('publicId');
      expect(response.body.data.mimeType).toBe('image/png');
      expect(response.body.data.provider).toBe('LocalStorage');

      uploadedFileUrl = response.body.data.url;
    });

    it('should upload a single image via /api/v1/storage/upload (Backward Compatibility)', async () => {
      const response = await request(app)
        .post('/api/v1/storage/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', testImageBuffer, 'legacy_upload_test.png');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data.mimeType).toBe('image/png');
    });

    it('should reject invalid file types (e.g. text/plain or script)', async () => {
      const textBuffer = Buffer.from('console.log("malicious")', 'utf8');

      const response = await request(app)
        .post('/api/v1/media/images')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', textBuffer, 'malicious.js');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_IMAGE_TYPE');
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app)
        .post('/api/v1/media/images')
        .attach('file', testImageBuffer, 'unauth.png');

      expect(response.status).toBe(401);
    });

    it('should return 400 when no file is attached', async () => {
      const response = await request(app)
        .post('/api/v1/media/images')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('FILE_REQUIRED');
    });
  });

  describe('POST /api/v1/media/images/multiple (Multiple Images Upload)', () => {
    it('should upload multiple images simultaneously', async () => {
      const response = await request(app)
        .post('/api/v1/media/images/multiple')
        .set('Authorization', `Bearer ${userToken}`)
        .field('type', 'DESTINATION')
        .attach('files', testImageBuffer, 'gili_trawangan_1.png')
        .attach('files', testImageBuffer, 'gili_meno_2.png');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/users/me/avatar (Avatar Upload Flow)', () => {
    it('should upload avatar and update user profile', async () => {
      const response = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', testImageBuffer, 'traveler_avatar.png');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('avatarUrl');
      expect(response.body.data.avatarUrl).toBeTruthy();
    });
  });

  describe('DELETE /api/v1/media/images (Delete Stored Image)', () => {
    it('should delete file by url or publicId and return success', async () => {
      const response = await request(app)
        .delete('/api/v1/media/images')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fileUrl: uploadedFileUrl,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
