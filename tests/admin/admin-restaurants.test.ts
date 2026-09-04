import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Restaurant Management API Suite (Phase 7)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdRestaurantId = '';
  let secondRestaurantId = '';
  const testSuffix = Date.now();
  const testSlug1 = `warung-nasi-balap-puyung-${testSuffix}`;
  const testSlug2 = `seafood-segar-pantai-nipah-${testSuffix}`;

  beforeAll(async () => {
    app = createApp();

    // Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login Standard User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('GET /api/v1/admin/restaurants (List & Filter Restaurants)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/restaurants');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated restaurants for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/restaurants?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(8);

      const firstRest = res.body.data[0];
      expect(firstRest).toHaveProperty('id');
      expect(firstRest).toHaveProperty('name');
      expect(firstRest).toHaveProperty('slug');
      expect(firstRest).toHaveProperty('cuisineType');
      expect(firstRest).toHaveProperty('specialtyDish');
      expect(firstRest).toHaveProperty('rating');
    });

    it('should filter restaurants by search keyword', async () => {
      const res = await request(app)
        .get('/api/v1/admin/restaurants?search=Taliwang')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.some(
          (r: any) =>
            r.name.toLowerCase().includes('taliwang') ||
            r.specialtyDish?.toLowerCase().includes('taliwang') ||
            r.description?.toLowerCase().includes('taliwang'),
        ),
      ).toBe(true);
    });

    it('should filter restaurants by region, cuisine, and rating', async () => {
      const res = await request(app)
        .get('/api/v1/admin/restaurants?region=LOMBOK_BARAT&minRating=4.0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((r: any) => r.region === 'LOMBOK_BARAT')).toBe(true);
    });
  });

  describe('POST /api/v1/admin/restaurants (Create Restaurant)', () => {
    it('should reject creation with missing required fields (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'RM',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should create a new restaurant successfully (201 Created)', async () => {
      const payload = {
        name: `Warung Nasi Balap Puyung Cap Inaq ${testSuffix}`,
        slug: testSlug1,
        description: 'Kuliner pedas khas Lombok Tengah dengan suwiran ayam gurih pedas dan kedelai goreng.',
        cuisineType: 'Tradisional Sasak',
        specialtyDish: 'Nasi Balap Puyung Super Pedas',
        priceRange: 'Rp 20.000 - Rp 45.000',
        minPrice: 20000,
        maxPrice: 45000,
        address: 'Jl. Raya Puyung, Jonggat, Lombok Tengah',
        region: 'LOMBOK_TENGAH',
        latitude: -8.7123,
        longitude: 116.2456,
        openingHours: '07:00 - 22:00 WITA',
        coverImageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
        images: [
          'https://images.unsplash.com/photo-1544025162-d76694265947',
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
        ],
        isHalalCertified: true,
        status: 'PUBLISHED',
        isFeatured: true,
      };

      const res = await request(app)
        .post('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe(payload.name);
      expect(res.body.data.slug).toBe(payload.slug);
      expect(res.body.data.isFeatured).toBe(true);
      expect(res.body.data.images.length).toBe(2);

      createdRestaurantId = res.body.data.id;
    });

    it('should reject creation if slug already exists (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Warung Nasi Balap Puyung Duplikat',
          slug: testSlug1,
          description: 'Deskripsi restoran duplikat',
          cuisineType: 'Tradisional Sasak',
          specialtyDish: 'Nasi Balap',
          priceRange: 'Rp 20.000',
          address: 'Lombok Tengah',
          region: 'LOMBOK_TENGAH',
          latitude: -8.7,
          longitude: 116.2,
          openingHours: '08:00 - 20:00',
          coverImageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('RESTAURANT_SLUG_EXISTS');
    });

    it('should create second restaurant for deletion testing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/restaurants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Seafood Segar Pantai Nipah ${testSuffix}`,
          slug: testSlug2,
          description: 'Ikan bakar segar tepi pantai Nipah dengan sambal beberoq pedas.',
          cuisineType: 'Seafood & Bakaran',
          specialtyDish: 'Ikan Baronang Bakar Madu',
          priceRange: 'Rp 40.000 - Rp 120.000',
          minPrice: 40000,
          maxPrice: 120000,
          address: 'Pantai Nipah, Pemenang, Lombok Utara',
          region: 'LOMBOK_UTARA',
          latitude: -8.452,
          longitude: 116.035,
          openingHours: '10:00 - 21:00 WITA',
          coverImageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947',
        });

      expect(res.status).toBe(201);
      secondRestaurantId = res.body.data.id;
    });
  });

  describe('GET /api/v1/admin/restaurants/:id (Get Restaurant Details)', () => {
    it('should return 404 for non-existent restaurant', async () => {
      const res = await request(app)
        .get('/api/v1/admin/restaurants/invalid_restaurant_xyz')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('RESTAURANT_NOT_FOUND');
    });

    it('should return restaurant details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdRestaurantId);
      expect(res.body.data.slug).toBe(testSlug1);
    });
  });

  describe('PUT /api/v1/admin/restaurants/:id (Update Restaurant)', () => {
    it('should update restaurant information successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          specialtyDish: 'Nasi Balap Puyung Level Max & Es Kelapa Muda',
          priceRange: 'Rp 25.000 - Rp 55.000',
          minPrice: 25000,
          maxPrice: 55000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.specialtyDish).toBe('Nasi Balap Puyung Level Max & Es Kelapa Muda');
      expect(res.body.data.minPrice).toBe(25000);
    });

    it('should allow updating restaurant fields while preserving existing coverImage and gallery images payload (200 OK)', async () => {
      const getRes = await request(app)
        .get(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const rest = getRes.body.data;

      const res = await request(app)
        .put(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Warung Nasi Balap Updated ${testSuffix}`,
          coverImage: {
            publicId: rest.coverImagePublicId || 'lombok-explorer/restaurants/puyung_cover',
            secureUrl: rest.coverImageUrl,
          },
          images: [
            {
              publicId: 'lombok-explorer/restaurants/puyung_gallery_1',
              secureUrl: 'https://images.unsplash.com/photo-puyung-1',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject update if new slug collides with existing restaurant (409 Conflict)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: testSlug2,
        });

      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('RESTAURANT_SLUG_EXISTS');
    });
  });

  describe('DELETE /api/v1/admin/restaurants/:id (Delete Restaurant)', () => {
    it('should soft-delete restaurant by default (status ARCHIVED)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Restaurant deleted successfully');

      // Verify status is ARCHIVED and deletedAt is populated
      const checkRes = await request(app)
        .get(`/api/v1/admin/restaurants/${createdRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('ARCHIVED');
      expect(checkRes.body.data.deletedAt).not.toBeNull();
    });

    it('should hard-delete restaurant when ?hard=true is provided', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/restaurants/${secondRestaurantId}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify restaurant is completely gone
      const checkRes = await request(app)
        .get(`/api/v1/admin/restaurants/${secondRestaurantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});
