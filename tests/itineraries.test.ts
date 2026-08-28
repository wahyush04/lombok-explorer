import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Itineraries & Trip API Module (Android Integration)', () => {
  let app: Application;
  let userTokenA = '';
  let userTokenB = '';
  let tripId = '';
  let day1Id = '';
  let day2Id = '';
  let stop1Id = '';
  let stop2Id = '';
  let stop3Id = '';
  let destAanId = '';
  let destMereseId = '';
  let shareToken = '';

  beforeAll(async () => {
    app = createApp();

    const suffix = `${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;
    const userA = {
      username: `planner_${suffix}`,
      name: 'Planner Android User',
      email: `planner.${suffix}@lombokexplorer.com`,
      password: 'PasswordItin123!',
    };

    const userB = {
      username: `traveler_${suffix}`,
      name: 'Traveler Other User',
      email: `traveler.${suffix}@lombokexplorer.com`,
      password: 'PasswordItin123!',
    };

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send(userA);
    userTokenA = resA.body.data.accessToken;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send(userB);
    userTokenB = resB.body.data.accessToken;

    // Fetch existing destinations or seed test destinations
    let dest1 = await prisma.destination.findFirst({
      where: { slug: 'pantai-tanjung-aan' },
    });
    if (!dest1) {
      dest1 = await prisma.destination.create({
        data: {
          name: 'Pantai Tanjung Aan',
          slug: 'pantai-tanjung-aan',
          description: 'Pantai pasir merica di Mandalika',
          coverImageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
          latitude: -8.9082,
          longitude: 116.3195,
          rating: 4.8,
          status: 'PUBLISHED',
        },
      });
    }
    destAanId = dest1.id;

    let dest2 = await prisma.destination.findFirst({
      where: { slug: 'bukit-merese' },
    });
    if (!dest2) {
      dest2 = await prisma.destination.create({
        data: {
          name: 'Bukit Merese',
          slug: 'bukit-merese',
          description: 'Bukit pemandangan sunset terindah di Lombok',
          coverImageUrl: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5',
          latitude: -8.9135,
          longitude: 116.3268,
          rating: 4.9,
          status: 'PUBLISHED',
        },
      });
    }
    destMereseId = dest2.id;
  });

  describe('1. Create Trip with daysCount (+ Auto-generate Days)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).post('/api/v1/itineraries').send({
        title: 'Trip Tanpa Login',
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should create trip with daysCount: 2 and auto-generate Hari 1 and Hari 2', async () => {
      const payload = {
        title: '3 Hari Liburan Seru di Lombok',
        description: 'Eksplorasi pantai dan bukit eksotis',
        daysCount: 2,
        travelStyle: 'BEACH_RELAXATION',
        budgetLevel: 'MID_RANGE',
        transportationMode: 'CAR',
        isPublic: false,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      };

      const res = await request(app)
        .post('/api/v1/itineraries')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.daysCount).toBe(2);
      expect(res.body.data.days.length).toBe(2);
      expect(res.body.data.days[0].title).toBe('Hari 1');
      expect(res.body.data.days[1].title).toBe('Hari 2');
      expect(res.body.data.transportationMode).toBe('CAR');

      tripId = res.body.data.id;
      day1Id = res.body.data.days[0].id;
      day2Id = res.body.data.days[1].id;
    });
  });

  describe('2. Day Management (+ Tambah Hari & Edit Hari)', () => {
    it('should add a 3rd day to the trip (+ Tambah Hari)', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/days`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          title: 'Hari 3: Wisata Belanja & Kuliner',
          notes: 'Membeli mutiara dan kain tenun Sasak',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.days.length).toBe(3);
      expect(res.body.data.days[2].title).toBe('Hari 3: Wisata Belanja & Kuliner');
      expect(res.body.data.days[2].dayNumber).toBe(3);
    });

    it('should update day 1 title and notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/itineraries/${tripId}/days/${day1Id}`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          title: 'Hari 1: Mandalika Coastal Explorer',
          notes: 'Gunakan kacamata hitam dan tabir surya',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updatedDay1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(updatedDay1.title).toBe('Hari 1: Mandalika Coastal Explorer');
      expect(updatedDay1.notes).toBe('Gunakan kacamata hitam dan tabir surya');
    });
  });

  describe('3. Stop & Activity Management (+ Tambah Stop, Edit Stop, Toggle Checklist)', () => {
    it('should add a catalog destination stop to Day 1', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          destinationId: destAanId,
          activityNotes: 'Berenang di air jernih Tanjung Aan',
          estimatedDurationMinutes: 120,
          estimatedCost: 10000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities.length).toBe(1);
      expect(day1.activities[0].destinationName).toContain('Tanjung Aan');
      expect(day1.activities[0].startTime).toBeDefined();
      expect(day1.activities[0].endTime).toBeDefined();
      expect(day1.activities[0].isCompleted).toBe(false);

      stop1Id = day1.activities[0].id;
    });

    it('should add a custom location stop (e.g. Kuliner/Hotel) to Day 1', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          customTitle: 'Makan Siang Nasi Balap Puyung',
          customLocation: {
            name: 'Warung Nasi Balap Puyung Mandalika',
            latitude: -8.8954,
            longitude: 116.2952,
            address: 'Jl. Raya Kuta Mandalika',
          },
          activityNotes: 'Makan siang kuliner khas Lombok',
          estimatedDurationMinutes: 60,
          estimatedCost: 35000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities.length).toBe(2);
      expect(day1.activities[1].destinationName).toContain('Nasi Balap Puyung');
      expect(day1.activities[1].distanceFromPrevKm).toBeGreaterThan(0);
      expect(day1.activities[1].travelTimeFromPrevMinutes).toBeGreaterThan(0);
      expect(day1.segments.length).toBe(1);

      stop2Id = day1.activities[1].id;
    });

    it('should add a 3rd stop (Bukit Merese) to Day 1', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          destinationId: destMereseId,
          activityNotes: 'Golden sunset photography di Bukit Merese',
          estimatedDurationMinutes: 90,
          estimatedCost: 15000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities.length).toBe(3);
      expect(day1.segments.length).toBe(2);

      stop3Id = day1.activities[2].id;
    });

    it('should toggle stop checklist isCompleted: true (Persistent)', async () => {
      const res = await request(app)
        .patch(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities/${stop1Id}`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          isCompleted: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      const stop1 = day1.activities.find((a: any) => a.id === stop1Id);
      expect(stop1.isCompleted).toBe(true);
    });
  });

  describe('4. Drag & Drop Reorder Stops & Route Recalculation', () => {
    it('should reorder stops in Day 1 and recalculate itinerary route segments', async () => {
      // Swap stop 1 and stop 2
      const reorderPayload = {
        activities: [
          { id: stop2Id, orderIndex: 0 },
          { id: stop1Id, orderIndex: 1 },
          { id: stop3Id, orderIndex: 2 },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send(reorderPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities[0].id).toBe(stop2Id);
      expect(day1.activities[1].id).toBe(stop1Id);
      expect(day1.activities[2].id).toBe(stop3Id);
      expect(day1.segments[0].fromActivityId).toBe(stop2Id);
      expect(day1.segments[0].toActivityId).toBe(stop1Id);
    });
  });

  describe('5. Route Optimization (Optimasi Rute)', () => {
    it('should optimize route of the trip via Mapbox / 2-Opt solver', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/optimize`)
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          dayId: day1Id,
          scope: 'DAY',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities.length).toBe(3);
      expect(day1.totalDistanceKm).toBeGreaterThan(0);
      expect(day1.totalTravelTimeMinutes).toBeGreaterThan(0);
    });
  });

  describe('6. Delete Stop with Automatic Re-indexing', () => {
    it('should delete stop 2 and re-index remaining stops', async () => {
      const res = await request(app)
        .delete(`/api/v1/itineraries/${tripId}/days/${day1Id}/activities/${stop2Id}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const day1 = res.body.data.days.find((d: any) => d.id === day1Id);
      expect(day1.activities.length).toBe(2);
      expect(day1.activities[0].orderIndex).toBe(0);
      expect(day1.activities[1].orderIndex).toBe(1);
    });
  });

  describe('7. Delete Day with Sequential Re-indexing (Hapus Hari)', () => {
    it('should delete Day 2 and re-index Day 3 to become Day 2', async () => {
      const res = await request(app)
        .delete(`/api/v1/itineraries/${tripId}/days/${day2Id}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.days.length).toBe(2);
      expect(res.body.data.days[0].dayNumber).toBe(1);
      expect(res.body.data.days[1].dayNumber).toBe(2);
      expect(res.body.data.days[1].title).toBe('Hari 3: Wisata Belanja & Kuliner');
    });
  });

  describe('8. Trip Sharing & Public Access', () => {
    it('should generate a share link for the trip', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/share`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shareToken).toBeDefined();
      expect(res.body.data.shareUrl).toContain(res.body.data.shareToken);

      shareToken = res.body.data.shareToken;
    });

    it('should fetch the shared trip via public URL without authorization header', async () => {
      const res = await request(app).get(`/api/v1/shared/itineraries/${shareToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(tripId);
      expect(res.body.data.days.length).toBe(2);
    });
  });

  describe('9. Trip Duplication & Permissions', () => {
    it('should reject unauthorized user trying to edit the trip (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/itineraries/${tripId}`)
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ title: 'Hacked Trip Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should duplicate trip to User B account', async () => {
      const res = await request(app)
        .post(`/api/v1/itineraries/${tripId}/duplicate`)
        .set('Authorization', `Bearer ${userTokenB}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('(Copy)');
      expect(res.body.data.userId).toBeDefined();
      expect(res.body.data.days.length).toBe(2);
    });
  });

  describe('10. Delete Trip', () => {
    it('should delete the trip when requested by owner', async () => {
      const res = await request(app)
        .delete(`/api/v1/itineraries/${tripId}`)
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fetchRes = await request(app).get(`/api/v1/itineraries/${tripId}`);
      expect(fetchRes.status).toBe(404);
    });
  });
});
