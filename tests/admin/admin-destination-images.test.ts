import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { prisma } from '../../src/database/prisma';
import { storageService } from '../../src/modules/storage/storage.service';
import { localStorageProvider } from '../../src/modules/storage/providers';

describe('Admin Destination Images Management API Suite (Phase 6)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let adminUserId = '';
  let createdImageId = '';
  let uploadedImageId = '';
  const testDestinationId = 'test_temp_admin_gallery';

  beforeAll(async () => {
    app = createApp();
    storageService.setProvider(localStorageProvider);

    // 0. Create dedicated temporary test destination
    await prisma.destinationImage.deleteMany({ where: { destinationId: testDestinationId } });
    await prisma.destination.deleteMany({ where: { id: testDestinationId } });
    await prisma.destination.create({
      data: {
        id: testDestinationId,
        slug: `temp-gallery-test-${Date.now()}`,
        name: 'Temporary Gallery Test Destination',
        shortDescription: 'Temp test destination',
        description: 'Temp test destination description',
        categoryId: 'cat_beach',
        region: 'LOMBOK_SELATAN',
        locationName: 'Pujut',
        latitude: -8.9,
        longitude: 116.3,
        openingHours: '06:00 - 18:00',
        bestVisitingTime: 'Pagi hari',
        difficulty: 'EASY',
        estimatedDurationMinutes: 60,
        tags: '[]',
        facilities: '[]',
        coverImageUrl:
          'https://res.cloudinary.com/tzccdgab/image/upload/f_auto,q_auto,w_1000/v1788267657/lombok-explorer/examples/pexels-ari-setiawan-2156420701-38061830.jpg',
      },
    });

    const suffix = Date.now();

    // 1. Regular user registration
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `trav_img_${suffix.toString().slice(-6)}`,
      name: `Traveler ${suffix}`,
      email: `traveler.img.${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 2. Admin registration & promotion
    const adminEmail = `admin.img.${suffix}@lombokexplorer.com`;
    await request(app).post('/api/v1/auth/register').send({
      username: `adm_img_${suffix.toString().slice(-6)}`,
      name: `Admin ${suffix}`,
      email: adminEmail,
      password: 'Password123!',
    });
    const updatedAdmin = await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });
    adminUserId = updatedAdmin.id;

    const adminLogin = await request(app).post('/api/v1/admin/auth/login').send({
      email: adminEmail,
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.destinationImage.deleteMany({ where: { destinationId: testDestinationId } });
    await prisma.destination.deleteMany({ where: { id: testDestinationId } });
  });

  describe('GET /api/v1/admin/destinations/:id/images (List Gallery Images)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/admin/destinations/${testDestinationId}/images`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return 404 for non-existent destination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations/invalid_dest_xyz/images')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });

    it('should return list of images for valid destination with admin token', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/admin/destinations/:id/images (Add Gallery Image)', () => {
    it('should reject image creation when neither file nor imageUrl is provided (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Foto tanpa URL maupun file',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('IMAGE_REQUIRED');
    });

    it('should create image from imageUrl JSON payload (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
          caption: 'Sunset di atas Bukit Merese Tanjung Aan',
          altText: 'Foto bukit merese tanjung aan lombok',
          orderIndex: 1,
          isPrimary: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.destinationId).toBe(testDestinationId);
      expect(res.body.data.imageUrl).toBe('https://images.unsplash.com/photo-1544644181-1484b3fdfc62');
      expect(res.body.data.caption).toBe('Sunset di atas Bukit Merese Tanjung Aan');
      expect(res.body.data.altText).toBe('Foto bukit merese tanjung aan lombok');
      expect(res.body.data.orderIndex).toBe(1);
      expect(res.body.data.isPrimary).toBe(false);

      createdImageId = res.body.data.id;
    });

    it('should create image from Cloudinary asset JSON payload and promote as primary image (201 Created)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          image: {
            publicId: `lombok-explorer/admin/${adminUserId}/destinations/${testDestinationId}/sess_123/tanjung_aan_gallery`,
            secureUrl:
              `https://res.cloudinary.com/tzccdgab/image/upload/v1788267657/lombok-explorer/admin/${adminUserId}/destinations/tanjung_aan_gallery.webp`,
            width: 1920,
            height: 1080,
            format: 'webp',
          },
          caption: 'Pemandangan laut biru toska Tanjung Aan',
          altText: 'Hamparan pasir merica dan air laut jernih',
          orderIndex: 0,
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.imageUrl).toContain('tanjung_aan_gallery.webp');
      expect(res.body.data.imagePublicId).toContain('tanjung_aan_gallery');
      expect(res.body.data.isPrimary).toBe(true);
      expect(res.body.data.orderIndex).toBe(0);

      uploadedImageId = res.body.data.id;

      // Verify that destination cover image was updated to this primary image
      const destRes = await request(app)
        .get(`/api/v1/admin/destinations/${testDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(destRes.body.data.coverImageUrl).toBe(res.body.data.imageUrl);
    });
  });

  describe('PUT /api/v1/admin/destinations/:id/images/:imageId (Update Gallery Image)', () => {
    it('should return 404 for non-existent image ID', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/destinations/${testDestinationId}/images/invalid_img_id`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Updated Caption',
        });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_IMAGE_NOT_FOUND');
    });

    it('should update image attributes successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/destinations/${testDestinationId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Sunset Magis Bukit Merese (Updated)',
          altText: 'Pemandangan golden hour bukit merese',
          orderIndex: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caption).toBe('Sunset Magis Bukit Merese (Updated)');
      expect(res.body.data.altText).toBe('Pemandangan golden hour bukit merese');
      expect(res.body.data.orderIndex).toBe(5);
    });

    it('should allow updating destination image caption/altText while passing back existing image payload without 403 Forbidden (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/destinations/${testDestinationId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Sunset Magis Bukit Merese Pasir Putih',
          image: {
            publicId: 'lombok-explorer/destinations/merese_sample_img',
            secureUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caption).toBe('Sunset Magis Bukit Merese Pasir Putih');
    });
  });

  describe('DELETE /api/v1/admin/destinations/:id/images/:imageId (Delete Gallery Image)', () => {
    it('should return 404 when deleting a non-existent image', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/destinations/${testDestinationId}/images/invalid_img_id`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_IMAGE_NOT_FOUND');
    });

    it('should delete images successfully (200 OK)', async () => {
      const res1 = await request(app)
        .delete(`/api/v1/admin/destinations/${testDestinationId}/images/${createdImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.message).toBe('Destination image deleted successfully');

      if (uploadedImageId) {
        const res2 = await request(app)
          .delete(`/api/v1/admin/destinations/${testDestinationId}/images/${uploadedImageId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res2.status).toBe(200);
        expect(res2.body.success).toBe(true);
      }
    });
  });
});
