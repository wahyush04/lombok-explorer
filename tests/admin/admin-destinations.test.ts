import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Destinations Management API Suite (Phase 4)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdDestinationId = '';

  beforeAll(async () => {
    app = createApp();

    // Login as Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login as Standard User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('GET /api/v1/admin/destinations (List & Filter)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/destinations');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin user tokens with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated destinations for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(35);
    });

    it('should filter destinations by search query', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?search=Rinjani')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((d: any) => d.name.includes('Rinjani'))).toBe(true);
    });

    it('should filter destinations by category and region', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?region=LOMBOK_SELATAN&isFeatured=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((item: any) => {
        expect(item.region).toBe('LOMBOK_SELATAN');
        expect(item.isFeatured).toBe(true);
      });
    });

    it('should sort destinations by rating descending', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations?sortBy=rating&order=desc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(res.body.data[i].rating).toBeGreaterThanOrEqual(res.body.data[i + 1].rating);
      }
    });
  });

  describe('POST /api/v1/admin/destinations (Create Destination)', () => {
    it('should reject creation when required fields are missing (400 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'P',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject creation if categoryId is invalid (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pantai Test Baru',
          description: 'Deskripsi pengujian pantai baru di Lombok untuk admin API test.',
          categoryId: 'invalid_cat_xyz',
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut, Lombok Tengah',
          latitude: -8.9,
          longitude: 116.3,
        });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('CATEGORY_NOT_FOUND');
    });

    it('should create a new destination successfully (201 Created)', async () => {
      const newDestPayload = {
        name: 'Pantai Semeti Hidden Paradise',
        description: 'Pantai eksotis dengan formasi batu karang mirip piramida di Lombok Tengah.',
        shortDescription: 'Pantai eksotis batu karang mirip piramida',
        categoryId: 'cat_beach',
        region: 'LOMBOK_SELATAN',
        locationName: 'Desa Selong Belanak, Praya Barat',
        address: 'Jl. Pantai Semeti, Lombok Tengah, NTB',
        latitude: -8.8824,
        longitude: 116.1952,
        ticketPrice: 15000,
        estimatedDurationMinutes: 90,
        openingHours: '06:00 - 18:00',
        bestVisitingTime: 'Pagi hari sebelum terik',
        difficulty: 'MODERATE',
        tags: ['Karang Piramida', 'Hidden Gem', 'Fotografi'],
        facilities: ['Area Parkir', 'Spot Foto'],
        tips: ['Gunakan alas kaki anti selip'],
        status: 'PUBLISHED',
        isFeatured: true,
      };

      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newDestPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Pantai Semeti Hidden Paradise');
      expect(res.body.data.slug).toContain('pantai-semeti-hidden-paradise');
      expect(res.body.data.ticketPrice).toBe(15000);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.isFeatured).toBe(true);
      expect(res.body.data.tags).toContain('Hidden Gem');
      expect(res.body.data.facilities).toContain('Spot Foto');

      createdDestinationId = res.body.data.id;
    });
  });

  describe('GET /api/v1/admin/destinations/:id (Get Details)', () => {
    it('should return 404 for non-existent destination ID', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations/non_existent_dest_id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });

    it('should retrieve destination details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdDestinationId);
      expect(res.body.data.name).toBe('Pantai Semeti Hidden Paradise');
    });
  });

  describe('PUT /api/v1/admin/destinations/:id (Update Destination)', () => {
    it('should update destination fields successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ticketPrice: 20000,
          status: 'DRAFT',
          isFeatured: false,
          shortDescription: 'Updated short description for Semeti beach',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketPrice).toBe(20000);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.isFeatured).toBe(false);
      expect(res.body.data.shortDescription).toBe('Updated short description for Semeti beach');
    });

    it('should allow updating destination fields while preserving existing coverImage and gallery images payload (200 OK)', async () => {
      const getRes = await request(app)
        .get(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const dest = getRes.body.data;

      const res = await request(app)
        .put(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pantai Semeti Hidden Paradise Updated',
          coverImage: {
            publicId: dest.coverImagePublicId || 'lombok-explorer/destinations/semeti_cover',
            secureUrl: dest.coverImageUrl || 'https://images.unsplash.com/photo-semeti',
          },
          images: [
            {
              publicId: 'lombok-explorer/destinations/semeti_gallery_1',
              secureUrl: 'https://images.unsplash.com/photo-semeti-1',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Pantai Semeti Hidden Paradise Updated');
    });

    it('should return 404 when updating non-existent destination', async () => {
      const res = await request(app)
        .put('/api/v1/admin/destinations/non_existent_123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ticketPrice: 5000 });

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/admin/destinations/:id (Delete Destination)', () => {
    it('should soft delete destination by default (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted successfully');

      // Verify soft deleted state in admin details
      const detailRes = await request(app)
        .get(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.deletedAt).not.toBeNull();
      expect(detailRes.body.data.status).toBe('ARCHIVED');
    });

    it('should permanently hard delete destination with ?hard=true', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/destinations/${createdDestinationId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that it is completely gone
      const detailRes = await request(app)
        .get(`/api/v1/admin/destinations/${createdDestinationId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(404);
    });
  });
});
