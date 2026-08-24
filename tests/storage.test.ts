import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app';
import { storageService } from '../src/modules/storage/storage.service';
import { cloudStorageProvider, localStorageProvider } from '../src/modules/storage/providers';

describe('Storage & Image Upload API Module (Phase 19)', () => {
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
    const res = await request(app).post('/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test file if it exists
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      await fs.promises.unlink(uploadedFilePath).catch(() => {});
    }
  });

  describe('POST /v1/storage/upload (Single Image Upload)', () => {
    it('should upload a single image and return local asset URL', async () => {
      const response = await request(app)
        .post('/v1/storage/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', testImageBuffer, 'test_beach_merese.png');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('path');
      expect(response.body.data.mimeType).toBe('image/png');
      expect(response.body.data.provider).toBe('LocalStorage');
      expect(response.body.data.url).toMatch(/^\/assets\/image\/.+\.png$/);

      uploadedFileUrl = response.body.data.url;
      uploadedFilePath = response.body.data.path;

      // Verify file actually written to filesystem
      expect(fs.existsSync(uploadedFilePath)).toBe(true);
    });

    it('should serve the uploaded image statically via Express at public URL', async () => {
      const response = await request(app).get(uploadedFileUrl);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.body).toBeDefined();
    });

    it('should reject invalid file types (e.g. text/plain or executable)', async () => {
      const textBuffer = Buffer.from('console.log("hello")', 'utf8');

      const response = await request(app)
        .post('/v1/storage/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', textBuffer, 'script.js');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_IMAGE_MIME_TYPE');
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app)
        .post('/v1/storage/upload')
        .attach('file', testImageBuffer, 'unauth.png');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /v1/storage/upload-multiple (Multiple Images Upload)', () => {
    it('should upload multiple images simultaneously and return array of URLs', async () => {
      const response = await request(app)
        .post('/v1/storage/upload-multiple')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('files', testImageBuffer, 'gili_trawangan_1.png')
        .attach('files', testImageBuffer, 'gili_meno_2.png');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].url).toContain('/assets/image/');
      expect(response.body.data[1].url).toContain('/assets/image/');

      // Clean up multiple files
      for (const item of response.body.data) {
        if (item.path && fs.existsSync(item.path)) {
          await fs.promises.unlink(item.path).catch(() => {});
        }
      }
    });
  });

  describe('Storage Provider Abstraction & Switching', () => {
    it('should allow hot-swapping provider to CloudStorageProvider', async () => {
      storageService.setProvider(cloudStorageProvider);
      expect(storageService.getActiveProviderName()).toBe('CloudStorage');

      const result = await storageService.uploadFile({
        buffer: testImageBuffer,
        originalname: 'rinjani_summit.jpg',
        mimetype: 'image/jpeg',
      });

      expect(result.provider).toBe('CloudStorage');
      expect(result.url).toContain('https://cdn.lombokexplorer.com/assets/image/');

      // Restore to LocalStorageProvider
      storageService.setProvider(localStorageProvider);
      expect(storageService.getActiveProviderName()).toBe('LocalStorage');
    });
  });

  describe('DELETE /v1/storage/delete (Delete Stored File)', () => {
    it('should delete file from filesystem and return success', async () => {
      expect(fs.existsSync(uploadedFilePath)).toBe(true);

      const response = await request(app)
        .delete('/v1/storage/delete')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          fileUrl: uploadedFileUrl,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify file removed from disk
      expect(fs.existsSync(uploadedFilePath)).toBe(false);
    });
  });
});
