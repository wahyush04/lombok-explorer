import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Account Settings Feature Suite (Edit Profile, Change Password, Logout, Delete Account)', () => {
  let app: Application;
  const testSuffix = Date.now().toString().slice(-6);

  const testUserA = {
    username: `settings_user_a_${testSuffix}`,
    name: 'User Alpha Settings',
    email: `settings_a_${testSuffix}@example.com`,
    password: 'PasswordAlpha123!',
  };

  const testUserB = {
    username: `settings_user_b_${testSuffix}`,
    name: 'User Beta Settings',
    email: `settings_b_${testSuffix}@example.com`,
    password: 'PasswordBeta123!',
  };

  let tokenA = '';
  let userIdA = '';
  let tokenB = '';
  let userIdB = '';

  beforeAll(async () => {
    app = createApp();

    // 1. Register User A
    const resA = await request(app).post('/api/v1/auth/register').send(testUserA);
    expect(resA.status).toBe(201);
    tokenA = resA.body.data.accessToken;
    userIdA = resA.body.data.user.id;

    // 2. Register User B
    const resB = await request(app).post('/api/v1/auth/register').send(testUserB);
    expect(resB.status).toBe(201);
    tokenB = resB.body.data.accessToken;
    userIdB = resB.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.deviceToken.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.post.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userIdA, userIdB] } },
    });
  });

  // =========================================================================
  // 1. EDIT PROFILE (PATCH /api/v1/users/me)
  // =========================================================================
  describe('1. Edit Profile (PATCH /api/v1/users/me)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .send({ fullName: 'Unauthorized Test' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should update profile with fullName, phoneNumber, and shortBio', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fullName: 'Alpha Renamed Traveler',
          phoneNumber: '+6289876543210',
          shortBio: 'Lover of Lombok beaches and waterfalls.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alpha Renamed Traveler');
      expect(res.body.data.phone).toBe('+6289876543210');
      expect(res.body.data.shortBio).toBe('Lover of Lombok beaches and waterfalls.');

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { id: userIdA } });
      expect(dbUser?.name).toBe('Alpha Renamed Traveler');
      expect(dbUser?.phone).toBe('+6289876543210');
      expect(dbUser?.shortBio).toBe('Lover of Lombok beaches and waterfalls.');
    });

    it('should support partial update without overwriting untouched fields', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          shortBio: 'Updated bio only.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shortBio).toBe('Updated bio only.');
      // Name and phone should remain preserved
      expect(res.body.data.name).toBe('Alpha Renamed Traveler');
      expect(res.body.data.phone).toBe('+6289876543210');
    });

    it('should support legacy aliases (name, phone, bio)', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Alpha Via Name Alias',
          phone: '+628111222333',
          bio: 'Bio via alias.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alpha Via Name Alias');
      expect(res.body.data.phone).toBe('+628111222333');
      expect(res.body.data.shortBio).toBe('Bio via alias.');
    });

    it('should update username when available and unique', async () => {
      const newUsername = `alpha_updated_${Date.now().toString().slice(-5)}`;
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: newUsername,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe(newUsername);
    });

    it('should reject username update if already taken by another user with 409', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: testUserB.username,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('USERNAME_ALREADY_EXISTS');
    });

    it('should reject username update with reserved or invalid format', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          username: 'system',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate Cloudinary asset ownership for avatarPublicId', async () => {
      // Trying to attach another user's asset
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          avatarPublicId: 'lombok-explorer/users/another-user-id/avatar123',
          avatarUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.jpg',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('UNAUTHORIZED_ASSET_ACCESS');
    });

    it('should allow valid user avatar asset belonging to the authenticated user', async () => {
      const validAvatarPublicId = `lombok-explorer/users/${userIdA}/avatar_${Date.now()}`;
      const validAvatarUrl = `https://res.cloudinary.com/test/image/upload/${validAvatarPublicId}.webp`;

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          avatarPublicId: validAvatarPublicId,
          avatarUrl: validAvatarUrl,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.avatarPublicId).toBe(validAvatarPublicId);
      expect(res.body.data.avatarUrl).toBe(validAvatarUrl);
    });
  });

  // =========================================================================
  // 2. CHANGE PASSWORD (POST /api/v1/auth/change-password & POST /api/v1/users/me/change-password)
  // =========================================================================
  describe('2. Change Password Flow', () => {
    it('should reject change password without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: testUserA.password,
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(401);
    });

    it('should reject change password when current password is wrong (400 INVALID_CURRENT_PASSWORD)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'WrongCurrentPassword!',
          newPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('should reject change password when new password is same as current password (400 SAME_PASSWORD)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: testUserA.password,
          newPassword: testUserA.password,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('SAME_PASSWORD');
    });

    it('should reject change password when new password is too short (<6 characters)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: testUserA.password,
          newPassword: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject when confirmPassword does not match newPassword', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: testUserA.password,
          newPassword: 'ValidNewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should successfully change password via POST /api/v1/auth/change-password', async () => {
      const newPassword = 'BrandNewPassword123!';
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: testUserA.password,
          newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that old password no longer works
      const oldLogin = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.email,
        password: testUserA.password,
      });
      expect(oldLogin.status).toBe(401);

      // Verify that new password works
      const newLogin = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.email,
        password: newPassword,
      });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.success).toBe(true);

      // Update tokenA for subsequent tests
      tokenA = newLogin.body.data.accessToken;
      testUserA.password = newPassword;
    });

    it('should successfully change password via alias POST /api/v1/users/me/change-password', async () => {
      const secondNewPassword = 'SecondNewPassword123!';
      const res = await request(app)
        .post('/api/v1/users/me/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: testUserA.password,
          newPassword: secondNewPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      testUserA.password = secondNewPassword;

      // Re-login to refresh tokenA
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserA.email,
        password: secondNewPassword,
      });
      expect(loginRes.status).toBe(200);
      tokenA = loginRes.body.data.accessToken;
    });

    it('should allow Google-only user (no existing password) to set a password without currentPassword', async () => {
      // Create a simulated Google user without password
      const googleUserSuffix = Date.now().toString().slice(-5);
      const googleUser = await prisma.user.create({
        data: {
          id: `usr_google_${googleUserSuffix}`,
          email: `google_${googleUserSuffix}@example.com`,
          username: `google_user_${googleUserSuffix}`,
          name: 'Google Traveler',
          password: null, // No password
          isEmailVerified: true,
        },
      });

      // Issue token for this Google user
      const { authService } = await import('../src/modules/auth/auth.service');
      const tokens = authService.generateTokens(googleUser);

      // Setting password without currentPassword should succeed
      const setPasswordRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          newPassword: 'FirstPassword123!',
        });

      expect(setPasswordRes.status).toBe(200);
      expect(setPasswordRes.body.success).toBe(true);

      // Now user can log in with new password
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: googleUser.email,
        password: 'FirstPassword123!',
      });
      expect(loginRes.status).toBe(200);

      // Cleanup
      await prisma.user.delete({ where: { id: googleUser.id } });
    });
  });

  // =========================================================================
  // 3. LOGOUT (POST /api/v1/auth/logout)
  // =========================================================================
  describe('3. Logout (POST /api/v1/auth/logout)', () => {
    it('should successfully logout and clear refreshToken from DB', async () => {
      // Login first to get fresh tokens
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: testUserB.email,
        password: testUserB.password,
      });
      expect(loginRes.status).toBe(200);
      const activeToken = loginRes.body.data.accessToken;
      const refreshToken = loginRes.body.data.refreshToken;

      // Verify refreshToken exists in DB
      const userBefore = await prisma.user.findUnique({ where: { id: userIdB } });
      expect(userBefore?.refreshToken).not.toBeNull();

      // Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${activeToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify refreshToken is cleared in DB
      const userAfter = await prisma.user.findUnique({ where: { id: userIdB } });
      expect(userAfter?.refreshToken).toBeNull();

      // Attempting to refresh with old refresh token should now fail
      const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken,
      });
      expect(refreshRes.status).toBe(401);
    });
  });

  // =========================================================================
  // 4. DELETE ACCOUNT (DELETE /api/v1/users/me)
  // =========================================================================
  describe('4. Delete Account (DELETE /api/v1/users/me)', () => {
    let deleteUserId = '';
    let deleteToken = '';
    const deletePassword = 'DeleteMePassword123!';

    beforeAll(async () => {
      const suffix = Date.now().toString().slice(-5);
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: `to_delete_${suffix}`,
          name: 'Deletable User',
          email: `delete_${suffix}@example.com`,
          password: deletePassword,
        });

      expect(res.status).toBe(201);
      deleteToken = res.body.data.accessToken;
      deleteUserId = res.body.data.user.id;

      // Set avatar and register a device token and a post to test comprehensive cleanup
      await prisma.user.update({
        where: { id: deleteUserId },
        data: {
          avatarPublicId: `lombok-explorer/users/${deleteUserId}/avatar_test`,
        },
      });

      await prisma.deviceToken.create({
        data: {
          userId: deleteUserId,
          token: `fcm_token_to_delete_${suffix}`,
          platform: 'ANDROID',
        },
      });

      await prisma.post.create({
        data: {
          userId: deleteUserId,
          title: 'Post to be soft deleted',
          description: 'Description of post to be soft deleted',
        },
      });
    });

    it('should reject unauthenticated account deletion with 401', async () => {
      const res = await request(app).delete('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('should soft-delete account, clear tokens, and clean up associated resources', async () => {
      const res = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${deleteToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 1. Verify User state in DB
      const user = await prisma.user.findUnique({ where: { id: deleteUserId } });
      expect(user?.deletedAt).not.toBeNull();
      expect(user?.status).toBe('INACTIVE');
      expect(user?.refreshToken).toBeNull();

      // 2. Verify DeviceTokens are cleared
      const deviceTokens = await prisma.deviceToken.findMany({ where: { userId: deleteUserId } });
      expect(deviceTokens).toHaveLength(0);

      // 3. Verify user's posts are soft deleted
      const posts = await prisma.post.findMany({ where: { userId: deleteUserId } });
      expect(posts.every((p) => p.deletedAt !== null && p.status === 'DELETED')).toBe(true);
    });

    it('should prevent deleted user from logging in again (401 ACCOUNT_DELETED)', async () => {
      const dbUser = await prisma.user.findUnique({ where: { id: deleteUserId } });
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: dbUser!.email,
        password: deletePassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ACCOUNT_DELETED');
    });

    it('should return 404 when querying profile of soft-deleted user', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${deleteToken}`);

      // The findById filter ignores deletedAt != null, returning 404 USER_NOT_FOUND
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('USER_NOT_FOUND');
    });
  });
});
