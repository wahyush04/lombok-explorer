import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { cloudinaryService } from '../../src/modules/cloudinary/cloudinary.service';
import { prisma } from '../../src/database/prisma';

describe('Admin Cloudinary Signed Upload & Asset Security Suite', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let adminUserId = '';

  beforeAll(async () => {
    app = createApp();

    const suffix = Date.now();

    // 1. Register regular user
    const userRes = await request(app).post('/api/v1/auth/register').send({
      username: `trav_${suffix.toString().slice(-6)}`,
      name: `Traveler ${suffix}`,
      email: `traveler.${suffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    expect(userRes.status).toBe(201);
    userToken = userRes.body.data.accessToken;

    // 2. Register admin user & promote in DB
    const adminEmail = `admin.${suffix}@lombokexplorer.com`;
    const adminReg = await request(app).post('/api/v1/auth/register').send({
      username: `admin_${suffix.toString().slice(-6)}`,
      name: `Admin ${suffix}`,
      email: adminEmail,
      password: 'Password123!',
    });
    expect(adminReg.status).toBe(201);

    const updatedUser = await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });
    adminUserId = updatedUser.id;

    // 3. Login as admin
    const adminLogin = await request(app).post('/api/v1/admin/auth/login').send({
      email: adminEmail,
      password: 'Password123!',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;
  });

  describe('1. POST /api/v1/admin/uploads/signature - Access Control & Validation', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .send({ resourceType: 'DESTINATION' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject standard non-admin traveler with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ resourceType: 'DESTINATION' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should reject missing or invalid resourceType with 400 Bad Request', async () => {
      const res1 = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resourceType: 'INVALID_TYPE' });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    it('should generate signed upload parameters for DESTINATION (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resourceType: 'DESTINATION' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('signature');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('apiKey');
      expect(res.body.data).toHaveProperty('cloudName');
      expect(res.body.data).toHaveProperty('folder');
      expect(res.body.data).toHaveProperty('uploadUrl');
      expect(res.body.data).toHaveProperty('allowedFormats');
      expect(res.body.data).toHaveProperty('maxFileSize');
      expect(res.body.data).toHaveProperty('uploadSessionId');
      expect(res.body.data.resourceType).toBe('DESTINATION');

      // Verify folder hierarchy isolation: lombok-explorer/admin/{adminId}/destinations/{uploadSessionId}
      expect(res.body.data.folder).toMatch(
        new RegExp(`^lombok-explorer/admin/${adminUserId}/destinations/`)
      );

      // Verify no secrets leaked
      expect(res.body.data).not.toHaveProperty('apiSecret');
    });

    it('should include resourceId in folder hierarchy when provided for update workflows', async () => {
      const targetEntityId = 'dest_123456';
      const res = await request(app)
        .post('/api/v1/admin/uploads/signature')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'DESTINATION_IMAGE',
          resourceId: targetEntityId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.folder).toMatch(
        new RegExp(`^lombok-explorer/admin/${adminUserId}/destinations/${targetEntityId}/`)
      );
    });

    it('should support all standard CMS resource types', async () => {
      const types = [
        'DESTINATION',
        'DESTINATION_IMAGE',
        'CATEGORY',
        'RESTAURANT',
        'ACCOMMODATION',
        'ITINERARY_TEMPLATE',
        'USER_AVATAR',
      ] as const;

      for (const type of types) {
        const res = await request(app)
          .post('/api/v1/admin/uploads/signature')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ resourceType: type });

        expect(res.status).toBe(200);
        expect(res.body.data.resourceType).toBe(type);
      }
    });
  });

  describe('2. Asset Ownership Validation & Security on CMS Endpoints', () => {
    it('should reject Category creation with publicId belonging to another admin or invalid folder (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Hacked Category ${Date.now()}`,
          description: 'Testing unauthorized publicId',
          iconName: 'category',
          coverImage: {
            publicId: 'lombok-explorer/admin/usr_other_hacker/categories/evil_img',
            secureUrl: 'https://res.cloudinary.com/tzccdgab/image/upload/v1/evil.jpg',
          },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('UNAUTHORIZED_ASSET_ACCESS');
    });

    it('should reject Destination creation with unowned images asset in gallery array (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Injected Asset Destination',
          description: 'Long description of test destination here for validation',
          categoryId: 'cat_beach',
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut',
          latitude: -8.9,
          longitude: 116.3,
          images: [
            {
              publicId: 'lombok-explorer/admin/usr_imposter/destinations/bad_image',
              secureUrl: 'https://res.cloudinary.com/tzccdgab/image/upload/v1/bad.jpg',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('UNAUTHORIZED_ASSET_ACCESS');
    });
  });

  describe('3. Transactional Rollback Asset Cleanup Simulation', () => {
    it('should trigger deleteMultipleAssets when destination database insertion fails', async () => {
      const deleteMultipleSpy = vi.spyOn(cloudinaryService, 'deleteMultipleAssets').mockResolvedValue(undefined);
      const createSpy = vi.spyOn(prisma.destination, 'create').mockRejectedValueOnce(new Error('Simulated Database Error'));

      const mockAsset = {
        publicId: `lombok-explorer/admin/${adminUserId}/destinations/sess_test/rollback_test_img`,
        secureUrl: 'https://res.cloudinary.com/tzccdgab/image/upload/v1/test.jpg',
      };

      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rollback Destination Test',
          description: 'Testing rollback mechanism when prisma transaction fails',
          categoryId: 'cat_beach',
          region: 'LOMBOK_SELATAN',
          locationName: 'Pujut',
          latitude: -8.9,
          longitude: 116.3,
          coverImage: mockAsset,
        });

      // Expect 500 failure from simulated DB insertion error
      expect(res.status).toBe(500);

      // Verify that Cloudinary cleanup was attempted for the uncommitted asset
      expect(deleteMultipleSpy).toHaveBeenCalledWith(
        expect.arrayContaining([mockAsset.publicId])
      );

      deleteMultipleSpy.mockRestore();
      createSpy.mockRestore();
    });
  });
});
