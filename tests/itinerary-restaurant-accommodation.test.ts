import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Itinerary Restaurant and Accommodation Images Scenario', () => {
  let app: Application;
  let userToken: string;
  let restaurant: any;
  let accommodation: any;

  beforeAll(async () => {
    app = createApp();

    // 1. Create or get test user
    const suffix = `${Date.now()}`;
    const user = {
      username: `itintest_${suffix}`,
      name: 'Itin Test User',
      email: `itintest.${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    };
    const regRes = await request(app).post('/api/v1/auth/register').send(user);
    userToken = regRes.body.data.accessToken;

    // 2. Create test restaurant with cover image and multiple images
    restaurant = await prisma.restaurant.create({
      data: {
        name: `Resto Uji Coba ${suffix}`,
        slug: `resto-uji-coba-${suffix}`,
        description: 'Kuliner lezat',
        cuisineType: 'Sasak',
        specialtyDish: 'Ayam Taliwang',
        openingHours: '09:00 - 22:00',
        priceRange: 'IDR 50.000 - 100.000',
        address: 'Jl. Raya Kuta',
        region: 'LOMBOK_SELATAN',
        latitude: -8.89,
        longitude: 116.28,
        coverImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
        status: 'PUBLISHED',
        images: {
          create: [
            {
              imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
              isPrimary: true,
              orderIndex: 0,
            },
            {
              imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
              isPrimary: false,
              orderIndex: 1,
            },
          ],
        },
      },
      include: { images: true },
    });

    // 3. Create test accommodation with cover image and multiple images
    accommodation = await prisma.accommodation.create({
      data: {
        name: `Hotel Uji Coba ${suffix}`,
        slug: `hotel-uji-coba-${suffix}`,
        description: 'Penginapan nyaman',
        type: 'resort',
        pricePerNight: 500000,
        address: 'Jl. Pantai Kuta',
        region: 'LOMBOK_SELATAN',
        latitude: -8.8,
        longitude: 116.2,
        coverImageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
        amenities: '["WiFi", "Pool"]',
        status: 'PUBLISHED',
        images: {
          create: [
            {
              imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
              isPrimary: true,
              orderIndex: 0,
            },
            {
              imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd',
              isPrimary: false,
              orderIndex: 1,
            },
          ],
        },
      },
      include: { images: true },
    });
  });

  it('POST /itineraries creates itinerary with restaurant & accommodation and returns their images', async () => {
    const res = await request(app)
      .post('/api/v1/itineraries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Trip Kuliner & Stay Liburan',
        days: [
          {
            title: 'Hari 1',
            items: [
              { restaurantId: restaurant.id, itemType: 'RESTAURANT' },
              { accommodationId: accommodation.id, itemType: 'ACCOMMODATION' },
              { restaurantId: restaurant.id },
              { accommodationId: accommodation.id },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    const itineraryId = res.body.data.id;
    const day = res.body.data.days[0];
    const activities = day.activities;

    // Item 0: Restaurant (with explicit itemType)
    expect(activities[0].itemType).toBe('RESTAURANT');
    expect(activities[0].restaurantId).toBe(restaurant.id);
    expect(activities[0].imageUrl).toBeTruthy();
    expect(activities[0].coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[0].images)).toBe(true);
    expect(activities[0].images.length).toBeGreaterThan(0);
    expect(activities[0].restaurant.imageUrl).toBeTruthy();
    expect(activities[0].restaurant.coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[0].restaurant.images)).toBe(true);

    // Item 1: Accommodation (with explicit itemType)
    expect(activities[1].itemType).toBe('ACCOMMODATION');
    expect(activities[1].accommodationId).toBe(accommodation.id);
    expect(activities[1].imageUrl).toBeTruthy();
    expect(activities[1].coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[1].images)).toBe(true);
    expect(activities[1].images.length).toBeGreaterThan(0);
    expect(activities[1].accommodation.imageUrl).toBeTruthy();
    expect(activities[1].accommodation.coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[1].accommodation.images)).toBe(true);

    // Item 2: Restaurant (inferred without explicit itemType)
    expect(activities[2].itemType).toBe('RESTAURANT');
    expect(activities[2].restaurantId).toBe(restaurant.id);
    expect(activities[2].imageUrl).toBeTruthy();
    expect(activities[2].coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[2].images)).toBe(true);
    expect(activities[2].images.length).toBeGreaterThan(0);
    expect(activities[2].destinationName).toBe(restaurant.name);

    // Item 3: Accommodation (inferred without explicit itemType)
    expect(activities[3].itemType).toBe('ACCOMMODATION');
    expect(activities[3].accommodationId).toBe(accommodation.id);
    expect(activities[3].imageUrl).toBeTruthy();
    expect(activities[3].coverImageUrl).toBeTruthy();
    expect(Array.isArray(activities[3].images)).toBe(true);
    expect(activities[3].images.length).toBeGreaterThan(0);
    expect(activities[3].destinationName).toBe(accommodation.name);

    // Test GET /itineraries/:id returns images for all items
    const getRes = await request(app)
      .get(`/api/v1/itineraries/${itineraryId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(getRes.status).toBe(200);
    const getActivities = getRes.body.data.days[0].activities;
    for (const act of getActivities) {
      expect(act.imageUrl).toBeTruthy();
      expect(act.coverImageUrl).toBeTruthy();
      expect(Array.isArray(act.images)).toBe(true);
      expect(act.images.length).toBeGreaterThan(0);
      if (act.itemType === 'RESTAURANT') {
        expect(act.restaurant.coverImageUrl).toBeTruthy();
        expect(Array.isArray(act.restaurant.images)).toBe(true);
      } else if (act.itemType === 'ACCOMMODATION') {
        expect(act.accommodation.coverImageUrl).toBeTruthy();
        expect(Array.isArray(act.accommodation.images)).toBe(true);
      }
    }

    // Test POST /activities with restaurantId
    const postRestActRes = await request(app)
      .post(`/api/v1/itineraries/${itineraryId}/days/${day.id}/activities`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ restaurantId: restaurant.id });

    expect(postRestActRes.status).toBe(201);
    const addedRestAct = postRestActRes.body.data.days[0].activities.find(
      (a: any) => a.orderIndex === 4,
    );
    expect(addedRestAct.itemType).toBe('RESTAURANT');
    expect(addedRestAct.imageUrl).toBeTruthy();
    expect(addedRestAct.coverImageUrl).toBeTruthy();
    expect(Array.isArray(addedRestAct.images)).toBe(true);
    expect(addedRestAct.restaurant.images.length).toBeGreaterThan(0);

    // Test POST /activities with accommodationId
    const postAccomActRes = await request(app)
      .post(`/api/v1/itineraries/${itineraryId}/days/${day.id}/activities`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ accommodationId: accommodation.id });

    expect(postAccomActRes.status).toBe(201);
    const addedAccomAct = postAccomActRes.body.data.days[0].activities.find(
      (a: any) => a.orderIndex === 5,
    );
    expect(addedAccomAct.itemType).toBe('ACCOMMODATION');
    expect(addedAccomAct.imageUrl).toBeTruthy();
    expect(addedAccomAct.coverImageUrl).toBeTruthy();
    expect(Array.isArray(addedAccomAct.images)).toBe(true);
    expect(addedAccomAct.accommodation.images.length).toBeGreaterThan(0);
  });
});
