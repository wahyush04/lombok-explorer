import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database/prisma';

describe('Admin Curated Itinerary Templates API (/api/v1/admin/itinerary-templates)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdTemplateId = '';
  let destAanId = '';

  beforeAll(async () => {
    app = createApp();
    const suffix = `${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;

    // Create an Admin user
    const adminRes = await request(app).post('/api/v1/auth/register').send({
      username: `admin_tmpl_${suffix}`,
      name: 'Admin Template Creator',
      email: `admin.tmpl.${suffix}@lombokexplorer.com`,
      password: 'PasswordAdmin123!',
    });
    // Promote user to ADMIN in DB
    await prisma.user.update({
      where: { email: `admin.tmpl.${suffix}@lombokexplorer.com` },
      data: { role: 'ADMIN' },
    });

    // Login as Admin to get updated token with ADMIN role
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: `admin.tmpl.${suffix}@lombokexplorer.com`,
      password: 'PasswordAdmin123!',
    });
    adminToken = loginRes.body.data.accessToken;

    // Create a regular user
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `normal_user_${suffix}`,
      name: 'Normal User',
      email: `normal.user.${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // Find an existing destination
    let dest = await prisma.destination.findFirst();
    if (!dest) {
      const cat = await prisma.category.findFirst() || await prisma.category.create({
        data: {
          name: 'Pantai & Bahari',
          slug: `pantai-bahari-${suffix}`,
          description: 'Wisata pantai',
          iconName: 'ic_beach',
          coverImageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
        },
      });
      dest = await prisma.destination.create({
        data: {
          name: 'Pantai Tanjung Aan',
          slug: `pantai-tanjung-aan-${suffix}`,
          shortDescription: 'Pantai pasir merica',
          description: 'Pantai pasir merica di Mandalika',
          categoryId: cat.id,
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut, Lombok Tengah',
          openingHours: '06:00 - 18:00',
          bestVisitingTime: 'Pagi atau sore hari',
          tags: '["Pantai", "Pasir Merica"]',
          facilities: '["Parkir", "Warung"]',
          coverImageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
          latitude: -8.9082,
          longitude: 116.3195,
          rating: 4.8,
          status: 'PUBLISHED',
        },
      });
    }
    destAanId = dest.id;
  });

  describe('1. Access Control & Authorization', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/admin/itinerary-templates');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin user with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/itinerary-templates')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Admin CRUD Operations', () => {
    it('should allow admin to create a new curated template with days and activities', async () => {
      const payload = {
        title: '3 Hari Jelajah Teluk Mandalika (Admin Curated)',
        description: 'Paket rekomendasi eksklusif kurasi tim Lombok Explorer',
        coverImageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
        totalDays: 2,
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        transportationMode: 'CAR',
        transportPaceNote: 'Mobil Sewa • Santai & Menyenangkan',
        totalEstimatedBudget: 950000,
        isPublished: true,
        isFeatured: true,
        sortOrder: 1,
        days: [
          {
            dayNumber: 1,
            title: 'Hari 1: Eksplorasi Tanjung Aan',
            notes: 'Siapkan topi dan kacamata hitam',
            totalDistanceKm: 12.5,
            totalDurationMinutes: 30,
            estimatedBudget: 450000,
            activities: [
              {
                destinationId: destAanId,
                orderIndex: 0,
                startTime: '08:30',
                endTime: '11:00',
                estimatedDurationMinutes: 150,
                estimatedCost: 10000,
                activityNotes: 'Bersantai di pasir merica',
              },
            ],
          },
          {
            dayNumber: 2,
            title: 'Hari 2: Menikmati Sunset',
            totalDistanceKm: 8.0,
            totalDurationMinutes: 20,
            estimatedBudget: 500000,
            activities: [],
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/admin/itinerary-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.days.length).toBe(2);
      expect(res.body.data.days[0].activities.length).toBe(1);

      createdTemplateId = res.body.data.id;
    });

    it('should list curated templates for admin with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/itinerary-templates?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });

    it('should retrieve curated template details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdTemplateId);
      expect(res.body.data.days.length).toBe(2);
    });

    it('should update template status and sort order', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '3 Hari Jelajah Teluk Mandalika (Updated)',
          isFeatured: false,
          sortOrder: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('3 Hari Jelajah Teluk Mandalika (Updated)');
      expect(res.body.data.isFeatured).toBe(false);
      expect(res.body.data.sortOrder).toBe(10);
    });

    it('should update template via PUT preserving existing coverImage payload (200 OK)', async () => {
      const getRes = await request(app)
        .get(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const tpl = getRes.body.data;

      const res = await request(app)
        .put(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '3 Hari Jelajah Mandalika & Tanjung Aan',
          coverImage: {
            publicId: tpl.coverImagePublicId || 'lombok-explorer/itinerary-templates/mandalika',
            secureUrl: tpl.coverImageUrl || 'https://images.unsplash.com/photo-tpl',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('3 Hari Jelajah Mandalika & Tanjung Aan');
    });

    it('should soft delete curated template', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fetchRes = await request(app)
        .get(`/api/v1/admin/itinerary-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetchRes.status).toBe(404);
    });
  });
});
