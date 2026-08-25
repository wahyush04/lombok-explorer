import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Accommodation Management API Suite (Phase 8)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdAccommodationId = '';
  let secondAccommodationId = '';
  const testSuffix = Date.now();
  const testSlug1 = `mandalika-luxury-hill-villa-${testSuffix}`;
  const testSlug2 = `sembalun-mountain-eco-lodge-${testSuffix}`;

  beforeAll(async () => {
    app = createApp();

    // Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login Regular User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('GET /api/v1/admin/accommodations (List & Filter Accommodations)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/accommodations');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated accommodations for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(7);

      const firstAcc = res.body.data[0];
      expect(firstAcc).toHaveProperty('id');
      expect(firstAcc).toHaveProperty('name');
      expect(firstAcc).toHaveProperty('slug');
      expect(firstAcc).toHaveProperty('type');
      expect(firstAcc).toHaveProperty('pricePerNight');
      expect(firstAcc).toHaveProperty('facilities');
    });

    it('should filter accommodations by search keyword', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations?search=Resort')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((a: any) => a.name.toLowerCase().includes('resort') || a.type.toLowerCase().includes('resort'))).toBe(true);
    });

    it('should filter accommodations by region, type, price, and facilities', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations?region=LOMBOK_BARAT&minPrice=1000000&facilities=Pool')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((a: any) => a.region === 'LOMBOK_BARAT')).toBe(true);
    });
  });

  describe('POST /api/v1/admin/accommodations (Create Accommodation)', () => {
    it('should reject creation with missing required fields (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/accommodations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Villa',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should create a new accommodation successfully (201 Created)', async () => {
      const payload = {
        name: `Mandalika Luxury Hill Villa ${testSuffix}`,
        slug: testSlug1,
        type: 'villa',
        description: 'Villa mewah modern di atas perbukitan Kuta Mandalika dengan pemandangan sirkuit dan samudra lepas.',
        pricePerNight: 2750000,
        currency: 'IDR',
        address: 'Jl. Pariwisata Kuta, Pujut, Lombok Tengah',
        region: 'LOMBOK_SELATAN',
        latitude: -8.889,
        longitude: 116.289,
        coverImageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914',
        images: [
          'https://images.unsplash.com/photo-1580587771525-78b9dba3b914',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
        ],
        facilities: ['Infinity Pool', 'Butler Service', 'Ocean View', 'Private Chef', 'High-Speed WiFi'],
        contactPhone: '+62 812 3456 7890',
        websiteUrl: 'https://mandalikaluxuryvilla.com',
        status: 'PUBLISHED',
        isFeatured: true,
      };

      const res = await request(app)
        .post('/api/v1/admin/accommodations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.slug).toBe(payload.slug);
      expect(res.body.data.type).toBe('villa');
      expect(res.body.data.pricePerNight).toBe(2750000);
      expect(res.body.data.facilities.length).toBe(5);
      expect(res.body.data.isFeatured).toBe(true);

      createdAccommodationId = res.body.data.id;
    });

    it('should reject creation if slug already exists (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/accommodations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mandalika Luxury Villa Duplikat',
          slug: testSlug1,
          type: 'villa',
          description: 'Deskripsi akomodasi duplikat',
          pricePerNight: 2000000,
          address: 'Kuta Lombok',
          region: 'LOMBOK_SELATAN',
          latitude: -8.88,
          longitude: 116.28,
          coverImageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ACCOMMODATION_SLUG_EXISTS');
    });

    it('should create second accommodation for deletion testing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/accommodations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Sembalun Mountain Eco Lodge ${testSuffix}`,
          slug: testSlug2,
          type: 'homestay',
          description: 'Penginapan kayu ramah lingkungan dengan pemandangan lembah sawah Sembalun dan Gunung Rinjani.',
          pricePerNight: 450000,
          address: 'Desa Sembalun Lawang, Lombok Timur',
          region: 'LOMBOK_TIMUR',
          latitude: -8.358,
          longitude: 116.528,
          coverImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          facilities: ['Water Heater', 'Mountain View', 'Breakfast Included', 'Bonfire Area'],
        });

      expect(res.status).toBe(201);
      secondAccommodationId = res.body.data.id;
    });
  });

  describe('GET /api/v1/admin/accommodations/:id (Get Accommodation Details)', () => {
    it('should return 404 for non-existent accommodation', async () => {
      const res = await request(app)
        .get('/api/v1/admin/accommodations/invalid_acc_xyz')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('ACCOMMODATION_NOT_FOUND');
    });

    it('should return accommodation details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/accommodations/${createdAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdAccommodationId);
      expect(res.body.data.slug).toBe(testSlug1);
    });
  });

  describe('PUT /api/v1/admin/accommodations/:id (Update Accommodation)', () => {
    it('should update accommodation information successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/accommodations/${createdAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricePerNight: 2950000,
          facilities: ['Infinity Pool', 'Butler Service', 'Ocean View', 'Private Chef', 'High-Speed WiFi', 'Helipad Access'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pricePerNight).toBe(2950000);
      expect(res.body.data.facilities.length).toBe(6);
    });

    it('should reject update if new slug collides with existing accommodation (409 Conflict)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/accommodations/${createdAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: testSlug2,
        });

      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('ACCOMMODATION_SLUG_EXISTS');
    });
  });

  describe('DELETE /api/v1/admin/accommodations/:id (Delete Accommodation)', () => {
    it('should soft-delete accommodation by default (status ARCHIVED)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/accommodations/${createdAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Accommodation deleted successfully');

      // Verify status is ARCHIVED and deletedAt is populated
      const checkRes = await request(app)
        .get(`/api/v1/admin/accommodations/${createdAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('ARCHIVED');
      expect(checkRes.body.data.deletedAt).not.toBeNull();
    });

    it('should hard-delete accommodation when ?hard=true is provided', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/accommodations/${secondAccommodationId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify accommodation is completely gone
      const checkRes = await request(app)
        .get(`/api/v1/admin/accommodations/${secondAccommodationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});
