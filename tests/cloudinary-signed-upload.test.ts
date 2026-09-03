import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { cloudinaryService } from '../src/modules/cloudinary/cloudinary.service';

const app = createApp();

describe('Cloudinary Signed Upload & Direct Client Image Architecture for Feeds', () => {
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let testPostId: string;

  beforeAll(async () => {
    // 1. Create or login User 1
    const user1Email = `user1_feed_${Date.now()}@example.com`;
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user1Email,
        password: 'Password@123',
        name: 'User One Cloudinary',
        username: `user1_feed_${Date.now()}`.substring(0, 25),
      });

    user1Token = reg1.body.data.accessToken;
    user1Id = reg1.body.data.user.id;

    // 2. Create or login User 2
    const user2Email = `user2_feed_${Date.now()}@example.com`;
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user2Email,
        password: 'Password@123',
        name: 'User Two Cloudinary',
        username: `user2_feed_${Date.now()}`.substring(0, 25),
      });

    user2Token = reg2.body.data.accessToken;
    user2Id = reg2.body.data.user.id;
  });

  afterAll(async () => {
    if (testPostId) {
      await prisma.post.deleteMany({ where: { id: testPostId } });
    }
    if (user1Id) {
      await prisma.user.deleteMany({ where: { id: { in: [user1Id, user2Id] } } });
    }
  });

  // =========================================================================
  // 1. GENERATE UPLOAD SIGNATURE
  // =========================================================================
  it('1. should generate valid signed upload parameters for authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ folder: 'feeds' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cloudName).toBeDefined();
    expect(res.body.data.apiKey).toBeDefined();
    expect(res.body.data.timestamp).toBeTypeOf('number');
    expect(res.body.data.signature).toBeTypeOf('string');
    expect(res.body.data.signature.length).toBeGreaterThan(10);
    expect(res.body.data.folder).toContain(`lombok-explorer/feeds/${user1Id}/`);
    expect(res.body.data.uploadUrl).toContain('api.cloudinary.com');
  });

  // =========================================================================
  // 2. UNAUTHENTICATED SIGNATURE REQUEST -> 401
  // =========================================================================
  it('2. should reject unauthenticated signature request with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/uploads/signature').send({ folder: 'feeds' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // 3. CREATE POST TANPA IMAGE -> VALIDATION ERROR
  // =========================================================================
  it('3. should reject create post without any images with validation error (400)', async () => {
    const res = await request(app)
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Sunset Pantai Mandalika',
        description: 'Pemandangan indah tanpa foto',
        location: {
          name: 'Pantai Kuta',
          latitude: -8.89,
          longitude: 116.28,
        },
        images: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // 4 & 5. CREATE POST DENGAN MULTIPLE IMAGES & ORDERINDEX
  // =========================================================================
  it('4 & 5. should create post with multiple images and strictly preserve orderIndex', async () => {
    const sessionUuid = 'test-session-uuid-1';
    const res = await request(app)
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Menikmati Sunset di Kuta Mandalika',
        description: 'Pengalaman menikmati sunset di bukit dengan pemandangan pantai indah.',
        location: {
          name: 'Pantai Kuta Mandalika',
          latitude: -8.89,
          longitude: 116.28,
        },
        images: [
          {
            publicId: `lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-1`,
            secureUrl: `https://res.cloudinary.com/tzccdgab/image/upload/v1/lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-1.jpg`,
            width: 1080,
            height: 1350,
            format: 'jpg',
            orderIndex: 0,
          },
          {
            publicId: `lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-2`,
            secureUrl: `https://res.cloudinary.com/tzccdgab/image/upload/v1/lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-2.jpg`,
            width: 1080,
            height: 1080,
            format: 'jpg',
            orderIndex: 1,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.images.length).toBe(2);
    expect(res.body.data.images[0].publicId).toBe(`lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-1`);
    expect(res.body.data.images[0].orderIndex).toBe(0);
    expect(res.body.data.images[1].publicId).toBe(`lombok-explorer/feeds/${user1Id}/${sessionUuid}/image-2`);
    expect(res.body.data.images[1].orderIndex).toBe(1);

    testPostId = res.body.data.id;
  });

  // =========================================================================
  // 6 & 7. SECURITY: REJECT USING ANOTHER USER'S ASSET OR INVALID PUBLIC_ID
  // =========================================================================
  it('6 & 7. should reject post creation using another user’s Cloudinary asset with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        title: 'Percobaan Menggunakan Foto User Lain',
        description: 'Postingan ini mencoba memakai asset milik user1',
        location: {
          name: 'Pantai Kuta',
          latitude: -8.89,
          longitude: 116.28,
        },
        images: [
          {
            // publicId belongs to user1Id, but authenticated user is user2Id!
            publicId: `lombok-explorer/feeds/${user1Id}/some-uuid/stolen-image`,
            secureUrl: 'https://res.cloudinary.com/tzccdgab/image/upload/sample.jpg',
            orderIndex: 0,
          },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not authorized to use or link this image');
  });

  // =========================================================================
  // 8. DATABASE FAILURE ROLLBACK -> CLOUDINARY CLEANUP
  // =========================================================================
  it('8. should trigger Cloudinary asset cleanup if database post creation fails', async () => {
    const cleanupSpy = vi.spyOn(cloudinaryService, 'deleteMultipleAssets');

    // Send invalid payload that passes service validation but fails destination FK
    const res = await request(app)
      .post('/api/v1/feeds')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Post Destination Error',
        description: 'Deskripsi valid',
        destinationId: 'non_existent_destination_id_99999',
        images: [
          {
            publicId: `lombok-explorer/feeds/${user1Id}/session-fail/image-fail`,
            secureUrl: 'https://res.cloudinary.com/sample.jpg',
            orderIndex: 0,
          },
        ],
      });

    expect(res.status).toBe(404);
    expect(cleanupSpy).toHaveBeenCalled();
    cleanupSpy.mockRestore();
  });

  // =========================================================================
  // 10. USER TIDAK DAPAT DELETE POST MILIK USER LAIN
  // =========================================================================
  it('10. should prevent user from deleting post owned by another user (403)', async () => {
    const res = await request(app)
      .delete(`/api/v1/feeds/${testPostId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // 11, 12, 13, 14, 15. UPDATE POST: EDIT TEXT, ADD, REMOVE, REORDER IMAGES
  // =========================================================================
  it('11, 12, 13, 14, 15. should update post, add new image, remove old image, and reorder images', async () => {
    const cleanupSpy = vi.spyOn(cloudinaryService, 'deleteMultipleAssets');
    const newSessionUuid = 'new-session-uuid-2';

    const res = await request(app)
      .patch(`/api/v1/feeds/${testPostId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Updated: Sunset Memukau di Kuta Mandalika',
        description: 'Deskripsi yang sudah diperbarui dengan cerita lebih lengkap.',
        images: [
          // Reorder: previously image-2 was index 1, now made index 0
          {
            publicId: `lombok-explorer/feeds/${user1Id}/test-session-uuid-1/image-2`,
            secureUrl: `https://res.cloudinary.com/tzccdgab/image/upload/v1/lombok-explorer/feeds/${user1Id}/test-session-uuid-1/image-2.jpg`,
            width: 1080,
            height: 1080,
            format: 'jpg',
            orderIndex: 0,
          },
          // Add: new image-3 as index 1
          {
            publicId: `lombok-explorer/feeds/${user1Id}/${newSessionUuid}/image-3`,
            secureUrl: `https://res.cloudinary.com/tzccdgab/image/upload/v1/lombok-explorer/feeds/${user1Id}/${newSessionUuid}/image-3.jpg`,
            width: 1920,
            height: 1080,
            format: 'jpg',
            orderIndex: 1,
          },
          // Note: image-1 is removed and should be cleaned up from Cloudinary
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated: Sunset Memukau di Kuta Mandalika');
    expect(res.body.data.images.length).toBe(2);

    // Verify ordering
    expect(res.body.data.images[0].publicId).toBe(`lombok-explorer/feeds/${user1Id}/test-session-uuid-1/image-2`);
    expect(res.body.data.images[0].orderIndex).toBe(0);
    expect(res.body.data.images[1].publicId).toBe(`lombok-explorer/feeds/${user1Id}/${newSessionUuid}/image-3`);
    expect(res.body.data.images[1].orderIndex).toBe(1);

    // Verify removed image-1 cleanup was triggered
    expect(cleanupSpy).toHaveBeenCalledWith(
      expect.arrayContaining([`lombok-explorer/feeds/${user1Id}/test-session-uuid-1/image-1`]),
    );
    cleanupSpy.mockRestore();
  });

  // =========================================================================
  // 9. DELETE POST -> DATABASE AND CLOUDINARY CLEANUP
  // =========================================================================
  it('9. should delete post and trigger Cloudinary asset cleanup', async () => {
    const cleanupSpy = vi.spyOn(cloudinaryService, 'deleteMultipleAssets');

    const res = await request(app)
      .delete(`/api/v1/feeds/${testPostId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify post is gone from DB
    const checkDb = await prisma.post.findUnique({ where: { id: testPostId } });
    expect(checkDb).toBeNull();

    // Verify Cloudinary deletion was triggered
    expect(cleanupSpy).toHaveBeenCalled();
    cleanupSpy.mockRestore();
  });
});
