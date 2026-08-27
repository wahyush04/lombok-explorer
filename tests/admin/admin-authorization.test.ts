import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Backend Authorization Security Matrix (Phase 16)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin (role: ADMIN)
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // 2. Register regular traveler user (role: USER)
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `traveler_${Date.now().toString().slice(-6)}`,
      name: `Regular Traveler ${suffix}`,
      email: `traveler_auth_${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body?.data?.accessToken || '';
  });

  const protectedEndpoints: { method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string; name: string }[] = [
    { method: 'get', path: '/api/v1/admin/auth/me', name: 'Admin Auth Me' },
    { method: 'get', path: '/api/v1/admin/dashboard', name: 'Admin Dashboard' },
    { method: 'get', path: '/api/v1/admin/destinations', name: 'Admin Destinations List' },
    { method: 'post', path: '/api/v1/admin/destinations/bulk-delete', name: 'Admin Destinations Bulk Delete' },
    { method: 'post', path: '/api/v1/admin/destinations/bulk-status', name: 'Admin Destinations Bulk Status' },
    { method: 'get', path: '/api/v1/admin/categories', name: 'Admin Categories List' },
    { method: 'get', path: '/api/v1/admin/restaurants', name: 'Admin Restaurants List' },
    { method: 'get', path: '/api/v1/admin/accommodations', name: 'Admin Accommodations List' },
    { method: 'get', path: '/api/v1/admin/users', name: 'Admin Users List' },
    { method: 'get', path: '/api/v1/admin/reviews', name: 'Admin Reviews List' },
    { method: 'get', path: '/api/v1/admin/audit-logs', name: 'Admin Audit Logs List' },
  ];

  describe('1. Unauthenticated Access Rejection (401 Unauthorized)', () => {
    for (const endpoint of protectedEndpoints) {
      it(`should reject unauthenticated request to ${endpoint.method.toUpperCase()} ${endpoint.path} with 401`, async () => {
        const reqObj = request(app)[endpoint.method](endpoint.path);
        const res = await reqObj;

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.errorCode).toBe('TOKEN_MISSING');
      });
    }
  });

  describe('2. Non-Admin (Standard User) Role Rejection (403 Forbidden)', () => {
    for (const endpoint of protectedEndpoints) {
      it(`should reject standard USER role for ${endpoint.method.toUpperCase()} ${endpoint.path} with 403`, async () => {
        const reqObj = request(app)[endpoint.method](endpoint.path).set(
          'Authorization',
          `Bearer ${userToken}`,
        );
        const res = await reqObj;

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
      });
    }
  });

  describe('3. Legitimate Administrator Access (200 OK / Authorized)', () => {
    for (const endpoint of protectedEndpoints) {
      if (endpoint.method === 'get') {
        it(`should permit verified ADMIN for ${endpoint.method.toUpperCase()} ${endpoint.path}`, async () => {
          const res = await request(app)
            .get(endpoint.path)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        });
      }
    }
  });
});
