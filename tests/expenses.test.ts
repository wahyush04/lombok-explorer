import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Expenses API Module (Phase 17)', () => {
  let app: Application;
  let userToken: string;
  let otherUserToken: string;
  let testItineraryId: string;
  let testExpenseId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Create or login test traveler
    const res1 = await request(app).post('/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = res1.body.data.accessToken;

    // 2. Create another user for permission testing
    const uniqueEmail = `other_traveler_${Date.now()}@example.com`;
    const res2 = await request(app).post('/v1/auth/register').send({
      name: 'Other Traveler',
      email: uniqueEmail,
      password: 'Password123!',
    });
    otherUserToken = res2.body.data.accessToken;

    // 3. Create a test itinerary with total estimated budget
    const itinRes = await request(app)
      .post('/v1/itineraries')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Lombok 3D2N Budget Trip',
        description: 'Budget trip to Lombok',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        totalEstimatedBudget: 3500000,
        isPublic: false,
        days: [
          {
            dayNumber: 1,
            title: 'Arrival & Beach',
            items: [
              {
                orderIndex: 0,
                customActivity: 'Arrive at Lombok Airport',
                startTime: '09:00',
                endTime: '10:00',
                estimatedCost: 150000,
              },
            ],
          },
        ],
      });

    testItineraryId = itinRes.body.data.id;
  });

  describe('POST /v1/itineraries/:id/expenses (Add Itinerary Expense)', () => {
    it('should add an expense item to the itinerary with category TRANSPORT', async () => {
      const response = await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Airport Taxi to Kuta Lombok',
          amount: 150000,
          category: 'TRANSPORT',
          currency: 'IDR',
          notes: 'Grab taxi',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Airport Taxi to Kuta Lombok');
      expect(response.body.data.amount).toBe(150000);
      expect(response.body.data.category).toBe('TRANSPORT');

      testExpenseId = response.body.data.id;
    });

    it('should add additional expenses with various categories (FOOD, ACCOMMODATION, ACTIVITY)', async () => {
      // Food
      await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Ayam Taliwang Dinner',
          amount: 120000,
          category: 'FOOD',
        });

      // Accommodation
      await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Homestay in Kuta',
          amount: 600000,
          category: 'ACCOMMODATION',
        });

      // Activity
      await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Snorkeling Tour Gili',
          amount: 250000,
          category: 'ACTIVITY',
        });
    });

    it('should return 403 when another user attempts to add expenses to the itinerary', async () => {
      const response = await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Unauthorized expense',
          amount: 50000,
          category: 'OTHER',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should return 400 when amount is negative or invalid', async () => {
      const response = await request(app)
        .post(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Invalid amount item',
          amount: -5000,
          category: 'OTHER',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/itineraries/:id/expenses (Get Itinerary Expenses Summary & Breakdown)', () => {
    it('should return total expense, budget, remaining budget, per person, and category breakdown', async () => {
      const response = await request(app)
        .get(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data).toHaveProperty('totalExpense');
      expect(data).toHaveProperty('budget');
      expect(data).toHaveProperty('remainingBudget');
      expect(data).toHaveProperty('perPerson');
      expect(data).toHaveProperty('breakdown');
      expect(data).toHaveProperty('expenses');

      // Budget was 3,500,000. Expenses = 150k + 120k + 600k + 250k = 1,120,000
      expect(data.totalExpense).toBe(1120000);
      expect(data.budget).toBe(3500000);
      expect(data.remainingBudget).toBe(3500000 - 1120000);
      expect(data.perPerson).toBe(1120000);

      // Check category breakdown
      expect(Array.isArray(data.breakdown)).toBe(true);
      expect(data.breakdown.length).toBeGreaterThanOrEqual(4);

      const transport = data.breakdown.find((b: { category: string }) => b.category === 'TRANSPORT');
      expect(transport).toBeDefined();
      expect(transport.totalAmount).toBe(150000);
    });

    it('should return 403 when another user attempts to view private itinerary expenses', async () => {
      const response = await request(app)
        .get(`/v1/itineraries/${testItineraryId}/expenses`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /v1/expenses/:id (Update Expense)', () => {
    it('should update the expense title, amount, and category successfully', async () => {
      const response = await request(app)
        .put(`/v1/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Airport Taxi to Kuta (Updated with tip)',
          amount: 175000,
          category: 'TRANSPORT',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(175000);
      expect(response.body.data.title).toContain('Updated');
    });

    it('should return 403 when another user tries to modify the expense', async () => {
      const response = await request(app)
        .put(`/v1/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Hacked title',
          amount: 1,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/expenses (General User Expenses)', () => {
    it('should list all expenses of the authenticated user with pagination', async () => {
      const response = await request(app)
        .get('/v1/expenses?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(4);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should filter expenses by category', async () => {
      const response = await request(app)
        .get('/v1/expenses?category=TRANSPORT')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      for (const item of response.body.data) {
        expect(item.category).toBe('TRANSPORT');
      }
    });
  });

  describe('DELETE /v1/expenses/:id (Delete Expense)', () => {
    it('should return 403 when another user attempts to delete the expense', async () => {
      const response = await request(app)
        .delete(`/v1/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should delete the expense item successfully by owner', async () => {
      const response = await request(app)
        .delete(`/v1/expenses/${testExpenseId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it no longer exists
      const check = await prisma.expense.findUnique({ where: { id: testExpenseId } });
      expect(check).toBeNull();
    });
  });
});
