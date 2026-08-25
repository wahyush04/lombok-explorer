import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Destination Images Management API Suite (Phase 6)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdImageId = '';
  let uploadedImageId = '';
  const testDestinationId = 'dest_tanjung_aan';

  beforeAll(async () => {
    app = createApp();

    // 1. Admin login
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Regular user login
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
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

    it('should upload image binary file via multipart/form-data and promote as primary image (201 Created)', async () => {
      const dummyImageBuffer = Buffer.from('fake-png-data-stream-buffer');

      const res = await request(app)
        .post(`/api/v1/admin/destinations/${testDestinationId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('caption', 'Pemandangan laut biru toska Tanjung Aan')
        .field('altText', 'Hamparan pasir merica dan air laut jernih')
        .field('orderIndex', '0')
        .field('isPrimary', 'true')
        .attach('image', dummyImageBuffer, 'tanjung_aan_gallery.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.imageUrl).toContain('/assets/image/');
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

      const res2 = await request(app)
        .delete(`/api/v1/admin/destinations/${testDestinationId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
    });
  });
});
