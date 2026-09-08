import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { prisma } from '../../src/database/prisma';
import { storageService } from '../../src/modules/storage/storage.service';
import { localStorageProvider } from '../../src/modules/storage/providers';

describe('Admin Accommodation & Restaurant Images Management API Suite', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let adminUserId = '';

  const testAccId = 'test_temp_admin_acc_gallery';
  const testRestId = 'test_temp_admin_rest_gallery';
  let createdAccImageId = '';
  let createdRestImageId = '';

  beforeAll(async () => {
    app = createApp();
    storageService.setProvider(localStorageProvider);

    // 0. Clean up previous test entities if any
    await prisma.accommodationImage.deleteMany({ where: { accommodationId: testAccId } });
    await prisma.accommodation.deleteMany({ where: { id: testAccId } });
    await prisma.restaurantImage.deleteMany({ where: { restaurantId: testRestId } });
    await prisma.restaurant.deleteMany({ where: { id: testRestId } });

    // 1. Create temporary test accommodation
    await prisma.accommodation.create({
      data: {
        id: testAccId,
        slug: testAccId,
        status: 'PUBLISHED',
        name: 'Temporary Accommodation For Gallery Testing',
        type: 'Hotel Bintang 4',
        description: 'Temporary accommodation test description',
        pricePerNight: 750000,
        currency: 'IDR',
        address: 'Jl. Pariwisata Senggigi',
        region: 'LOMBOK_BARAT',
        latitude: -8.5,
        longitude: 116.1,
        coverImageUrl: 'https://example.com/acc-cover.jpg',
        amenities: JSON.stringify(['Free WiFi', 'Pool']),
        images: {
          create: [
            {
              imageUrl: 'https://example.com/acc-initial-1.jpg',
              caption: 'Initial Room',
              altText: 'Initial Room Alt',
              orderIndex: 0,
              isPrimary: true,
            },
          ],
        },
      },
    });

    // 2. Create temporary test restaurant
    await prisma.restaurant.create({
      data: {
        id: testRestId,
        slug: testRestId,
        status: 'PUBLISHED',
        name: 'Temporary Restaurant For Gallery Testing',
        description: 'Temporary restaurant test description',
        cuisineType: 'Tradisional Sasak',
        specialtyDish: 'Ayam Taliwang Bakar',
        priceRange: 'Rp 30.000 - Rp 60.000',
        minPrice: 30000,
        maxPrice: 60000,
        address: 'Jl. Pejanggik Mataram',
        region: 'LOMBOK_BARAT',
        latitude: -8.58,
        longitude: 116.12,
        openingHours: '10:00 - 22:00',
        coverImageUrl: 'https://example.com/rest-cover.jpg',
        images: {
          create: [
            {
              imageUrl: 'https://example.com/rest-initial-1.jpg',
              caption: 'Initial Dining Area',
              altText: 'Initial Dining Alt',
              orderIndex: 0,
              isPrimary: true,
            },
          ],
        },
      },
    });

    const suffix = Date.now();

    // 3. Regular user registration
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `trav_gal_${suffix.toString().slice(-6)}`,
      name: `Traveler ${suffix}`,
      email: `traveler.gal.${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 4. Admin registration & promotion
    const adminEmail = `admin.gal.${suffix}@lombokexplorer.com`;
    await request(app).post('/api/v1/auth/register').send({
      username: `adm_gal_${suffix.toString().slice(-6)}`,
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
    await prisma.accommodationImage.deleteMany({ where: { accommodationId: testAccId } });
    await prisma.accommodation.deleteMany({ where: { id: testAccId } });
    await prisma.restaurantImage.deleteMany({ where: { restaurantId: testRestId } });
    await prisma.restaurant.deleteMany({ where: { id: testRestId } });
  });

  // =========================================================================
  // PUBLIC DTO MULTIPLE IMAGES COMPATIBILITY
  // =========================================================================
  describe('Public API Multiple Images Contract', () => {
    it('public accommodation detail should include cover image as first element in images array', async () => {
      const res = await request(app).get(`/api/v1/accommodations/${testAccId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images[0]).toBe('https://example.com/acc-cover.jpg');
      expect(res.body.data.images).toContain('https://example.com/acc-initial-1.jpg');
    });

    it('public restaurant detail should include cover image as first element in images array', async () => {
      const res = await request(app).get(`/api/v1/restaurants/${testRestId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images[0]).toBe('https://example.com/rest-cover.jpg');
      expect(res.body.data.images).toContain('https://example.com/rest-initial-1.jpg');
    });
  });

  // =========================================================================
  // ADMIN ACCOMMODATION IMAGES
  // =========================================================================
  describe('Admin Accommodation Images Sub-Routes (/api/v1/admin/accommodations/:id/images)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/v1/admin/accommodations/${testAccId}/images`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/accommodations/${testAccId}/images`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should list existing gallery images for an accommodation', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/accommodations/${testAccId}/images`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should add a new gallery image to accommodation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/accommodations/${testAccId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: 'https://example.com/acc-new-gallery.jpg',
          caption: 'Pool & Lounge View',
          altText: 'Accommodation pool and lounge area',
          orderIndex: 1,
          isPrimary: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.accommodationId).toBe(testAccId);
      expect(res.body.data.imageUrl).toBe('https://example.com/acc-new-gallery.jpg');
      expect(res.body.data.caption).toBe('Pool & Lounge View');
      expect(res.body.data.isPrimary).toBe(false);

      createdAccImageId = res.body.data.id;
    });

    it('should update accommodation gallery image and set as primary', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/accommodations/${testAccId}/images/${createdAccImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Updated Luxury Pool View',
          orderIndex: 0,
          isPrimary: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caption).toBe('Updated Luxury Pool View');
      expect(res.body.data.isPrimary).toBe(true);

      // Verify accommodation coverImageUrl was updated to new primary image
      const acc = await prisma.accommodation.findUnique({ where: { id: testAccId } });
      expect(acc?.coverImageUrl).toBe('https://example.com/acc-new-gallery.jpg');
    });

    it('should delete an image from accommodation gallery', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/accommodations/${testAccId}/images/${createdAccImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.accommodationImage.findUnique({
        where: { id: createdAccImageId },
      });
      expect(deleted).toBeNull();
    });
  });

  // =========================================================================
  // ADMIN RESTAURANT IMAGES
  // =========================================================================
  describe('Admin Restaurant Images Sub-Routes (/api/v1/admin/restaurants/:id/images)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/v1/admin/restaurants/${testRestId}/images`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin users with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/restaurants/${testRestId}/images`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should list existing gallery images for a restaurant', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/restaurants/${testRestId}/images`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should add a new gallery image to restaurant', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/restaurants/${testRestId}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: 'https://example.com/rest-new-culinary.jpg',
          caption: 'Specialty Dish Close Up',
          altText: 'Close up photo of specialty dish',
          orderIndex: 1,
          isPrimary: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.restaurantId).toBe(testRestId);
      expect(res.body.data.imageUrl).toBe('https://example.com/rest-new-culinary.jpg');
      expect(res.body.data.caption).toBe('Specialty Dish Close Up');
      expect(res.body.data.isPrimary).toBe(false);

      createdRestImageId = res.body.data.id;
    });

    it('should update restaurant gallery image and set as primary', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/restaurants/${testRestId}/images/${createdRestImageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          caption: 'Updated Signature Culinary',
          orderIndex: 0,
          isPrimary: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caption).toBe('Updated Signature Culinary');
      expect(res.body.data.isPrimary).toBe(true);

      // Verify restaurant coverImageUrl was updated to new primary image
      const rest = await prisma.restaurant.findUnique({ where: { id: testRestId } });
      expect(rest?.coverImageUrl).toBe('https://example.com/rest-new-culinary.jpg');
    });

    it('should delete an image from restaurant gallery', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/restaurants/${testRestId}/images/${createdRestImageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await prisma.restaurantImage.findUnique({
        where: { id: createdRestImageId },
      });
      expect(deleted).toBeNull();
    });
  });
});
