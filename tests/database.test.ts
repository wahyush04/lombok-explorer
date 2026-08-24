import { describe, it, expect } from 'vitest';
import { prisma } from '../src/database/prisma';

describe('Prisma Database Schema & Relations (Phase 4)', () => {
  it('should query at least 30 seeded destinations with categories and images', async () => {
    const destinations = await prisma.destination.findMany({
      include: {
        category: true,
        images: true,
      },
    });

    expect(destinations.length).toBeGreaterThanOrEqual(30);

    const first = destinations[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('latitude');
    expect(first).toHaveProperty('longitude');
    expect(first.category).toBeDefined();
    expect(first.images.length).toBeGreaterThan(0);
  });

  it('should query all 13 seeded categories', async () => {
    const categories = await prisma.category.findMany();
    expect(categories.length).toBeGreaterThanOrEqual(13);

    const slugs = categories.map((c) => c.slug);
    expect(slugs).toContain('beach');
    expect(slugs).toContain('waterfall');
    expect(slugs).toContain('mountain');
    expect(slugs).toContain('culture');
    expect(slugs).toContain('snorkeling');
    expect(slugs).toContain('diving');
    expect(slugs).toContain('sunset');
    expect(slugs).toContain('adventure');
  });

  it('should query user with nested favorites and reviews', async () => {
    const user = await prisma.user.findUnique({
      where: { id: 'usr_demo_lombok' },
      include: {
        favorites: {
          include: { destination: true },
        },
        reviews: true,
      },
    });

    expect(user).toBeDefined();
    expect(user?.email).toBe('traveler@lombokexplorer.com');
    expect(user?.favorites.length).toBeGreaterThanOrEqual(1);
    expect(user?.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it('should query itinerary with days and ordered activity items', async () => {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: 'itin_3days_lombok_classic' },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: { destination: true },
            },
          },
        },
      },
    });

    expect(itinerary).toBeDefined();
    expect(itinerary?.totalDays).toBe(3);
    expect(itinerary?.days.length).toBe(3);
    expect(itinerary?.days[0]?.items.length).toBe(3);
    expect(itinerary?.days[0]?.items[0]?.destination?.name).toBe('Desa Adat Sade');
  });

  it('should query recommendations with ordered destinations', async () => {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: 'rec_south_lombok_beach' },
      include: {
        destinations: {
          orderBy: { orderIndex: 'asc' },
          include: { destination: true },
        },
      },
    });

    expect(recommendation).toBeDefined();
    expect(recommendation?.destinations.length).toBe(4);
    expect(recommendation?.destinations[0]?.destination.id).toBe('dest_tanjung_aan');
  });

  it('should query restaurants, accommodations, checklists, journals, and weather cache', async () => {
    const restaurants = await prisma.restaurant.findMany();
    const accommodations = await prisma.accommodation.findMany();
    const weather = await prisma.weatherCache.findMany();
    const checklists = await prisma.checklist.findMany({ include: { items: true } });
    const journals = await prisma.travelJournal.findMany();

    expect(restaurants.length).toBeGreaterThanOrEqual(8);
    expect(accommodations.length).toBeGreaterThanOrEqual(7);
    expect(weather.length).toBeGreaterThanOrEqual(3);
    expect(checklists.length).toBeGreaterThanOrEqual(1);
    expect(journals.length).toBeGreaterThanOrEqual(1);
  });
});
