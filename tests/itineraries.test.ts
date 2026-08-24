import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('Itineraries API Module (Phase 13)', () => {
  let app: Application;
  let userTokenA = '';
  let userTokenB = '';
  let createdItineraryId = '';

  const userA = {
    name: 'Itinerary Planner Doni',
    email: `doni.itin.${Date.now()}@lombokexplorer.com`,
    password: 'PasswordItin123!',
  };

  const userB = {
    name: 'Traveler Eka',
    email: `eka.itin.${Date.now()}@lombokexplorer.com`,
    password: 'PasswordItin123!',
  };

  beforeAll(async () => {
    app = createApp();

    // Register User A
    const resA = await request(app).post('/v1/auth/register').send(userA);
    userTokenA = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post('/v1/auth/register').send(userB);
    userTokenB = resB.body.data.accessToken;
  });

  describe('POST /v1/itineraries (Create Multi-day Itinerary with Transaction)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const response = await request(app).post('/v1/itineraries').send({
        title: 'Trip Tanpa Login',
        days: [{ title: 'Hari 1', items: [] }],
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject payload with empty days (400 Bad Request)', async () => {
      const response = await request(app)
        .post('/v1/itineraries')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          title: 'Trip Kosong',
          days: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should create a multi-day itinerary with destinations and custom activities in a database transaction', async () => {
      const payload = {
        title: '3 Hari Eksplorasi Eksotis Lombok Selatan & Gili',
        description: 'Perjalanan santai menyusuri pantai pasir merica dan snorkeling di gili.',
        coverImageUrl: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5',
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        pace: 'BALANCED',
        isPublic: true,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        days: [
          {
            dayNumber: 1,
            title: 'Hari 1: Mandalika Coastal Discovery',
            date: '2026-09-01',
            notes: 'Fokus pantai pasir merica dan sunset',
            items: [
              {
                destinationId: 'dest_tanjung_aan',
                orderIndex: 1,
                timeSlot: '09:00 - 11:30',
                activityNotes: 'Berenang di air jernih Tanjung Aan',
                estimatedDurationMinutes: 150,
                estimatedCost: 20000,
              },
              {
                customTitle: 'Makan Siang Nasi Balap Puyung Kuta',
                orderIndex: 2,
                timeSlot: '12:00 - 13:00',
                activityNotes: 'Kuliner pedas khas Lombok',
                estimatedDurationMinutes: 60,
                estimatedCost: 35000,
              },
              {
                destinationId: 'dest_bukit_merese',
                orderIndex: 3,
                timeSlot: '16:30 - 18:30',
                activityNotes: 'Trekking ringan dan golden sunset di Bukit Merese',
                estimatedDurationMinutes: 120,
                estimatedCost: 15000,
              },
            ],
          },
          {
            dayNumber: 2,
            title: 'Hari 2: Gili Trawangan Island Life',
            date: '2026-09-02',
            notes: 'Snorkeling dengan penyu dan sepeda keliling pulau',
            items: [
              {
                destinationId: 'dest_gili_trawangan',
                orderIndex: 1,
                timeSlot: '09:00 - 14:00',
                activityNotes: 'Snorkeling 3 Gili dan makan siang seafood',
                estimatedDurationMinutes: 300,
                estimatedCost: 250000,
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/v1/itineraries')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(payload.title);
      expect(response.body.data.totalDays).toBe(2);
      expect(response.body.data.totalEstimatedBudget).toBe(320000); // 20000 + 35000 + 15000 + 250000
      expect(response.body.data.days.length).toBe(2);

      // Verify Day 1 items
      const day1 = response.body.data.days[0];
      expect(day1.activities.length).toBe(3);
      expect(day1.activities[0].destinationName).toContain('Tanjung Aan');
      expect(day1.activities[1].destinationName).toContain('Nasi Balap Puyung');

      createdItineraryId = response.body.data.id;
    });
  });

  describe('GET /v1/itineraries (List Itineraries)', () => {
    it('should return list of itineraries with pagination and metadata', async () => {
      const response = await request(app).get('/v1/itineraries?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  });

  describe('GET /v1/itineraries/:id (Detail Itinerary with Nested Days & Stops)', () => {
    it('should return complete itinerary structure with days, items, and destination info', async () => {
      const response = await request(app).get(`/v1/itineraries/${createdItineraryId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdItineraryId);
      expect(response.body.data.days.length).toBe(2);

      const day1 = response.body.data.days[0];
      expect(day1.activities.length).toBe(3);
      expect(day1.activities[0]).toHaveProperty('startTime');
      expect(day1.activities[0]).toHaveProperty('endTime');
      expect(day1.activities[0]).toHaveProperty('estimatedCost');
    });

    it('should return 404 for non-existent itinerary ID', async () => {
      const response = await request(app).get('/v1/itineraries/non-existent-itinerary-xyz');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('ITINERARY_NOT_FOUND');
    });
  });

  describe('PUT /v1/itineraries/:id (Update Itinerary with Transaction & Ownership Check)', () => {
    it('should reject update from a different user (403 Forbidden)', async () => {
      const response = await request(app)
        .put(`/v1/itineraries/${createdItineraryId}`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ title: 'Ganti Judul Orang Lain' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should update itinerary master data and replace days in a single transaction', async () => {
      const updatePayload = {
        title: 'Updated: 1 Hari Quick Trip Mandalika',
        description: 'Trip singkat 1 hari',
        days: [
          {
            dayNumber: 1,
            title: 'Hari 1: Express Mandalika',
            items: [
              {
                destinationId: 'dest_tanjung_aan',
                orderIndex: 1,
                timeSlot: '08:00 - 10:00',
                activityNotes: 'Morning swim',
                estimatedDurationMinutes: 120,
                estimatedCost: 25000,
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .put(`/v1/itineraries/${createdItineraryId}`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toContain('Updated: 1 Hari');
      expect(response.body.data.totalDays).toBe(1);
      expect(response.body.data.totalEstimatedBudget).toBe(25000);
      expect(response.body.data.days.length).toBe(1);
    });
  });

  describe('DELETE /v1/itineraries/:id (Delete Itinerary & Ownership Check)', () => {
    it('should reject deletion from non-owner (403 Forbidden)', async () => {
      const response = await request(app)
        .delete(`/v1/itineraries/${createdItineraryId}`)
        .set('Authorization', `Bearer ${userTokenB}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should delete itinerary when requested by owner', async () => {
      const response = await request(app)
        .delete(`/v1/itineraries/${createdItineraryId}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Subsequent fetch should return 404
      const getRes = await request(app).get(`/v1/itineraries/${createdItineraryId}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.errorCode).toBe('ITINERARY_NOT_FOUND');
    });
  });
});
