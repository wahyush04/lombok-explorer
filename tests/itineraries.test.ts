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
    let dests = await prisma.destination.findMany({
      where: { latitude: { not: 0 }, longitude: { not: 0 } },
      take: 2,
    });
    if (dests.length < 2) {
      const cat = await prisma.category.findFirst() || await prisma.category.create({
        data: {
          name: 'Pantai & Bahari',
          slug: `pantai-bahari-${suffix}`,
          description: 'Wisata pantai',
          iconName: 'ic_beach',
          coverImageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62',
        },
      });
      const d1 = await prisma.destination.create({
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
      const d2 = await prisma.destination.create({
        data: {
          name: 'Bukit Merese',
          slug: `bukit-merese-${suffix}`,
          shortDescription: 'Bukit sunset indah',
          description: 'Bukit pemandangan sunset terindah di Lombok',
          categoryId: cat.id,
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut, Lombok Tengah',
          openingHours: '06:00 - 18:30',
          bestVisitingTime: 'Sore menjelang sunset',
          tags: '["Bukit", "Sunset"]',
          facilities: '["Parkir", "Warung"]',
          coverImageUrl: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5',
          latitude: -8.9135,
          longitude: 116.3268,
          rating: 4.9,
          status: 'PUBLISHED',
        },
      });
      dests = [d1, d2];
    }
    destAanId = dests[0].id;
    destMereseId = dests[1].id;
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
      expect(day1.activities[0].destinationName).toBeDefined();
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

  describe('11. Active Trip Summary for Android Home Screen Widget (/api/v1/itineraries/active)', () => {
    let userTokenC = '';
    let userTokenD = '';
    let userCTripId = '';

    beforeAll(async () => {
      const suffix = `home_${Date.now().toString().slice(-6)}`;
      
      // Register new User C (has trip)
      const resC = await request(app).post('/api/v1/auth/register').send({
        username: `user_c_${suffix}`,
        name: 'User C with Trip',
        email: `userc_${suffix}@lombokexplorer.com`,
        password: 'Password123!',
      });
      userTokenC = resC.body.data.accessToken;

      // Register new User D (never creates trip)
      const resD = await request(app).post('/api/v1/auth/register').send({
        username: `user_d_${suffix}`,
        name: 'New User D Zero Trips',
        email: `userd_${suffix}@lombokexplorer.com`,
        password: 'Password123!',
      });
      userTokenD = resD.body.data.accessToken;

      // Create a private trip for User C
      const tripRes = await request(app)
        .post('/api/v1/itineraries')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          title: '3 Hari Liburan Seru di Lombok (Copy)',
          description: 'Eksplorasi Mandalika dan pantai selatan',
          daysCount: 2,
          transportationMode: 'CAR',
        });
      userCTripId = tripRes.body.data.id;
      const day1 = tripRes.body.data.days[0].id;

      // Update Day 1 title
      await request(app)
        .patch(`/api/v1/itineraries/${userCTripId}/days/${day1}`)
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          title: 'Mandalika Coastal Explorer',
        });

      // Add 2 stops to Day 1
      await request(app)
        .post(`/api/v1/itineraries/${userCTripId}/days/${day1}/activities`)
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          destinationId: destAanId,
          estimatedDurationMinutes: 90,
        });

      await request(app)
        .post(`/api/v1/itineraries/${userCTripId}/days/${day1}/activities`)
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          destinationId: destMereseId,
          estimatedDurationMinutes: 60,
        });
    });

    it('should return hasActiveTrip: false and trip: null for newly registered User D without trips', async () => {
      const res = await request(app)
        .get('/api/v1/itineraries/active')
        .set('Authorization', `Bearer ${userTokenD}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasActiveTrip).toBe(false);
      expect(res.body.data.trip).toBeNull();
      expect(res.body.message).toContain('does not have any active trip');
    });

    it('should return hasActiveTrip: false and trip: null for unauthenticated guest requests', async () => {
      const res = await request(app).get('/api/v1/itineraries/active');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasActiveTrip).toBe(false);
      expect(res.body.data.trip).toBeNull();
    });

    it('should return formatted active trip card matching Android UI design for User C', async () => {
      const res = await request(app)
        .get('/api/v1/itineraries/active')
        .set('Authorization', `Bearer ${userTokenC}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasActiveTrip).toBe(true);
      
      const trip = res.body.data.trip;
      expect(trip).toBeDefined();
      expect(trip.id).toBe(userCTripId);
      expect(trip.title).toBe('3 Hari Liburan Seru di Lombok (Copy)');
      expect(trip.badgeText).toBe('Hari 1 dari 2 Hari');
      expect(trip.totalDays).toBe(2);
      expect(trip.currentDayNumber).toBe(1);
      expect(trip.transportationMode).toBe('CAR');
      expect(trip.distanceFormatted).toContain('km');
      expect(trip.focus).toBeDefined();
      expect(trip.focus.dayNumber).toBe(1);
      expect(trip.focus.activityCount).toBe(2);
      expect(trip.focus.focusText).toBe('Fokus: Hari 1: Mandalika Coastal Explorer (2 Destinasi)');
      expect(trip.progress).toBeDefined();
      expect(trip.progress.totalActivities).toBe(2);
      expect(trip.progress.completedActivities).toBe(0);
      expect(trip.progress.percentage).toBe(0);
      expect(trip.progress.isCompleted).toBe(false);
    });

    it('should support /active-trip alias route identically', async () => {
      const res = await request(app)
        .get('/api/v1/itineraries/active-trip')
        .set('Authorization', `Bearer ${userTokenC}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasActiveTrip).toBe(true);
      expect(res.body.data.trip.id).toBe(userCTripId);
    });

    it('should maintain strict privacy and isolation between users', async () => {
      // User D still gets null even though User C has a private trip
      const resD = await request(app)
        .get('/api/v1/itineraries/active')
        .set('Authorization', `Bearer ${userTokenD}`);

      expect(resD.status).toBe(200);
      expect(resD.body.data.hasActiveTrip).toBe(false);
      expect(resD.body.data.trip).toBeNull();
    });
  });

  // =======================================================
  // 11. CURATED TEMPLATES RECOMMENDATIONS, BROWSE & APPLY
  // =======================================================
  describe('11. Curated Templates Recommendations, Browse & Apply', () => {
    let templateId = '';

    it('should retrieve curated recommendations list', async () => {
      const res = await request(app).get('/api/v1/itineraries/recommendations?limit=6');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const first = res.body.data[0];
      expect(first.id).toBeDefined();
      expect(first.title).toBeDefined();
      expect(first.totalDays).toBeGreaterThan(0);
      expect(first.destinationCount).toBeGreaterThanOrEqual(0);
      expect(first.isPublished).toBe(true);

      templateId = first.id;
    });

    it('should browse curated templates with filters and structured pagination metadata', async () => {
      const res = await request(app).get(
        '/api/v1/itineraries/browse?duration_filter=2_3_DAYS&page=1&limit=2',
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Success fetching itineraries');
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(typeof res.body.data.pagination.totalItems).toBe('number');
      expect(typeof res.body.data.pagination.totalPages).toBe('number');
      expect(typeof res.body.data.pagination.hasNext).toBe('boolean');

      // Verify all returned templates have 2 or 3 days
      for (const item of res.body.data.items) {
        expect([2, 3]).toContain(item.totalDays);
      }
    });

    it('should handle browse edge case with empty results and zero totalPages', async () => {
      const res = await request(app).get(
        '/api/v1/itineraries/browse?query=non_existent_destination_xyz123',
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
      });
    });

    it('should search templates by keyword and travel style', async () => {
      const res = await request(app).get(
        '/api/v1/itineraries/browse?query=Mandalika&travel_style=BEACH_RELAXATION',
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should preview curated template details by ID', async () => {
      const res = await request(app).get(`/api/v1/itineraries/templates/${templateId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(templateId);
      expect(Array.isArray(res.body.data.days)).toBe(true);
      if (res.body.data.days.length > 0 && res.body.data.days[0].activities.length > 0) {
        const act = res.body.data.days[0].activities[0];
        expect(act.travelDurationMinutes).toBeDefined();
        if (act.destination) {
          expect(act.destination.id).toBeDefined();
          expect(act.destination.name).toBeDefined();
        }
      }
    });

    it('should reject applying non-existent template with 404', async () => {
      const res = await request(app)
        .post('/api/v1/itineraries/apply')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          templateId: 'invalid_template_id_99999',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should apply curated template and return complete timeline ready for Android UI without extra GET', async () => {
      const applyPayload = {
        templateId,
        customTitle: 'Trip Liburan Impian Saya di Mandalika',
        startDate: '2026-10-01',
      };

      const res = await request(app)
        .post('/api/v1/itineraries/apply')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send(applyPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Template itinerary applied successfully');

      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.title).toBe(applyPayload.customTitle);
      expect(data.totalDays).toBeGreaterThan(0);
      expect(data.travelStyle).toBeDefined();
      expect(data.budgetLevel).toBeDefined();
      expect(data.transportationMode).toBeDefined();
      expect(data.totalEstimatedBudget).toBeGreaterThanOrEqual(0);
      expect(data.totalDistanceKm).toBeGreaterThanOrEqual(0);
      expect(data.totalDurationMinutes).toBeGreaterThanOrEqual(0);
      expect(data.startDate).toContain('2026-10-01');

      // Verify Complete Days & Activities structure is returned directly
      expect(Array.isArray(data.days)).toBe(true);
      expect(data.days.length).toBeGreaterThan(0);

      const day1 = data.days[0];
      expect(day1.id).toBeDefined();
      expect(day1.dayNumber).toBe(1);
      expect(day1.title).toBeDefined();
      expect(day1.totalDurationMinutes).toBeDefined();
      expect(day1.totalDistanceKm).toBeDefined();
      expect(Array.isArray(day1.activities)).toBe(true);

      if (day1.activities.length > 0) {
        const act = day1.activities[0];
        expect(act.id).toBeDefined();
        expect(act.orderIndex).toBeDefined();
        expect(act.timeSlot).toBeDefined();
        expect(act.estimatedDurationMinutes).toBeDefined();
        expect(act.travelDurationMinutes).toBeDefined();
        expect(act.isCompleted).toBe(false);

        // Destination consistency
        if (act.destinationId) {
          expect(act.destination).toBeDefined();
          expect(act.destination.id).toBe(act.destinationId);
          expect(act.destination.name).toBeDefined();
          expect(act.destinationName).toBeDefined();
        }
      }

      const clonedTripId = data.id;

      // User A can access their applied trip
      const fetchA = await request(app)
        .get(`/api/v1/itineraries/${clonedTripId}`)
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(fetchA.status).toBe(200);
      expect(fetchA.body.data.title).toBe(applyPayload.customTitle);

      // User B cannot access or modify User A's private applied trip
      const fetchB = await request(app)
        .get(`/api/v1/itineraries/${clonedTripId}`)
        .set('Authorization', `Bearer ${userTokenB}`);
      expect(fetchB.status).toBe(403);

      // Original template is still intact
      const templateCheck = await request(app).get(`/api/v1/itineraries/templates/${templateId}`);
      expect(templateCheck.status).toBe(200);
      expect(templateCheck.body.data.id).toBe(templateId);
    });
  });
});

