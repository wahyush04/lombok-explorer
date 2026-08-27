import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { ItineraryActivityDto, ItineraryDayDto } from '../src/modules/itineraries/dto/itinerary.dto';

describe('Smart Itinerary Generator API Module (Phase 14)', () => {
  let app: Application;
  let userToken = '';

  beforeAll(async () => {
    app = createApp();

    const suffix = `${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;
    const user = {
      username: `gen_u_${suffix}`,
      name: 'Generator Tester Hendra',
      email: `hendra.gen.${suffix}@lombokexplorer.com`,
      password: 'PasswordGen123!',
    };

    const res = await request(app).post('/v1/auth/register').send(user);
    userToken = res.body.data.accessToken;
  });

  describe('POST /v1/itineraries/generate (Smart AI Itinerary Generation)', () => {
    it('should generate an optimized multi-day beach itinerary with clustering and time slots', async () => {
      const payload = {
        startLocation: 'Bandara Internasional Lombok (LOP)',
        startDate: '2026-09-10',
        endDate: '2026-09-12', // 3 days
        numberOfTravelers: 2,
        transportation: 'CAR',
        travelStyle: 'BEACH_RELAXATION',
        interests: ['beach', 'snorkeling', 'sunset'],
        startTime: '08:30',
        endTime: '18:30',
        travelPace: 'BALANCED',
      };

      const response = await request(app).post('/v1/itineraries/generate').send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itinerary');
      expect(response.body.data).toHaveProperty('summary');

      const itin = response.body.data.itinerary;
      expect(itin.totalDays).toBe(3);
      expect(itin.days.length).toBe(3);
      expect(itin.travelStyle).toBe('BEACH_RELAXATION');

      // Verify each day has stops with time slots
      itin.days.forEach((day: ItineraryDayDto) => {
        expect(day.activities.length).toBeGreaterThan(0);
        day.activities.forEach((act: ItineraryActivityDto) => {
          expect(act).toHaveProperty('timeSlot');
          expect(act).toHaveProperty('startTime');
          expect(act).toHaveProperty('endTime');
          expect(act).toHaveProperty('estimatedDurationMinutes');
        });
      });

      // Verify summary calculations
      const summary = response.body.data.summary;
      expect(summary.totalDays).toBe(3);
      expect(summary.totalStops).toBeGreaterThan(0);
      expect(summary.budgetPerPerson).toBeGreaterThan(0);
      expect(summary.transportation).toBe('CAR');
    });

    it('should generate an adventure itinerary with INTENSE pace with more daily activities', async () => {
      const payload = {
        startLocation: 'Kota Mataram',
        startDate: '2026-09-15',
        endDate: '2026-09-16', // 2 days
        numberOfTravelers: 1,
        transportation: 'MOTORCYCLE',
        travelStyle: 'NATURE_ADVENTURE',
        interests: ['waterfall', 'mountain', 'trekking'],
        startTime: '07:30',
        endTime: '19:30',
        travelPace: 'INTENSE',
      };

      const response = await request(app).post('/v1/itineraries/generate').send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const itin = response.body.data.itinerary;
      expect(itin.totalDays).toBe(2);
      expect(itin.pace).toBe('INTENSE');
    });

    it('should save the generated itinerary into database when saveItinerary=true and user is authenticated', async () => {
      const payload = {
        startLocation: 'Kuta Mandalika Beach Area',
        startDate: '2026-09-20',
        endDate: '2026-09-21',
        numberOfTravelers: 2,
        transportation: 'CAR',
        travelStyle: 'BEACH_RELAXATION',
        saveItinerary: true,
      };

      const response = await request(app)
        .post('/v1/itineraries/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const savedItinId = response.body.data.itinerary.id;
      expect(savedItinId).not.toContain('itin_generated_'); // Saved entity has UUID

      // Fetch saved itinerary from GET /v1/itineraries/:id
      const fetchSaved = await request(app)
        .get(`/v1/itineraries/${savedItinId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(fetchSaved.status).toBe(200);
      expect(fetchSaved.body.data.id).toBe(savedItinId);
    });

    it('should fail with 400 when dates are missing', async () => {
      const response = await request(app)
        .post('/v1/itineraries/generate')
        .send({ travelStyle: 'BEACH_RELAXATION' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });
});
