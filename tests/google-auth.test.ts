import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { AuthProvider, UserRole, UserStatus } from '@prisma/client';
import { googleAuthService } from '../src/modules/auth/google-auth.service';

describe('Google Authentication, Registration & Dual-Method Auth (Phases 4, 5 & 6)', () => {
  let app: Application;

  const testGoogleUser = {
    email: 'new.google.traveler@example.com',
    sub: 'google_sub_109283746501928374650',
    name: 'Google Traveler',
    avatarUrl: 'https://lh3.googleusercontent.com/a/mock-photo-url',
  };

  const existingPasswordUser = {
    email: 'dual.auth.user@example.com',
    password: 'Password123!',
    name: 'Dual Auth Traveler',
    googleSub: 'google_sub_99887766554433221100',
  };

  beforeAll(async () => {
    app = createApp();

    // Clean up test data if any exists
    await prisma.authIdentity.deleteMany({
      where: {
        providerAccountId: {
          in: [testGoogleUser.sub, existingPasswordUser.googleSub, 'sub_suspended_google_999'],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            testGoogleUser.email,
            existingPasswordUser.email,
            'suspended.google@example.com',
            'inactive.google@example.com',
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up test users and identities
    await prisma.authIdentity.deleteMany({
      where: {
        providerAccountId: {
          in: [testGoogleUser.sub, existingPasswordUser.googleSub, 'sub_suspended_google_999'],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            testGoogleUser.email,
            existingPasswordUser.email,
            'suspended.google@example.com',
            'inactive.google@example.com',
          ],
        },
      },
    });
  });

  describe('1. Request Validation (Zod Middleware)', () => {
    it('should reject request when idToken is missing', async () => {
      const res = await request(app).post('/api/v1/auth/google').send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });

    it('should reject request when idToken is empty string', async () => {
      const res = await request(app).post('/api/v1/auth/google').send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });
  });

  describe('2. Google ID Token Verification Failure', () => {
    it('should reject invalid or forged Google ID Token with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'invalid.fake.jwt.token' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('errorCode', 'INVALID_GOOGLE_TOKEN');
    });
  });

  describe('3. Phase 5 — Google Account Belum Terdaftar (REGISTRATION_REQUIRED)', () => {
    let registrationToken: string;

    it('should return REGISTRATION_REQUIRED with registrationToken and profile when user does not exist', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: testGoogleUser.sub,
        email: testGoogleUser.email,
        name: testGoogleUser.name,
        avatarUrl: testGoogleUser.avatarUrl,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_new_user' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Registration required');
      expect(res.body.data).toHaveProperty('status', 'REGISTRATION_REQUIRED');
      expect(res.body.data).toHaveProperty('registrationToken');
      expect(res.body.data).toHaveProperty('profile');
      expect(res.body.data.profile).toHaveProperty('email', testGoogleUser.email);
      expect(res.body.data.profile).toHaveProperty('name', testGoogleUser.name);
      expect(res.body.data.profile).toHaveProperty('avatarUrl', testGoogleUser.avatarUrl);

      registrationToken = res.body.data.registrationToken;

      // Ensure user has NOT been created in DB yet
      const userInDb = await prisma.user.findUnique({
        where: { email: testGoogleUser.email },
      });
      expect(userInDb).toBeNull();
    });

    it('should NOT allow registrationToken to be used as an accessToken for protected routes', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${registrationToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('4. Phase 6 — Complete Google Registration (POST /api/v1/auth/google/register)', () => {
    let registrationToken: string;
    let registeredUserId: string;

    beforeAll(async () => {
      // Obtain fresh registration token
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: testGoogleUser.sub,
        email: testGoogleUser.email,
        name: testGoogleUser.name,
        avatarUrl: testGoogleUser.avatarUrl,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_new_user_2' });

      registrationToken = res.body.data.registrationToken;
    });

    it('should reject registration when registrationToken or password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google/register')
        .send({ username: 'wahyu' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid or tampered registrationToken', async () => {
      const res = await request(app).post('/api/v1/auth/google/register').send({
        registrationToken: 'tampered.token.here',
        username: 'wahyu',
        password: 'secure-password-123',
      });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('REGISTRATION_TOKEN_INVALID');
    });

    it('should successfully complete registration and create User + AuthIdentity in transaction', async () => {
      const res = await request(app).post('/api/v1/auth/google/register').send({
        registrationToken,
        username: 'wahyutraveler',
        password: 'securePassword@2026',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Registration successful');
      expect(res.body.data).toHaveProperty('status', 'REGISTRATION_SUCCESS');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).toHaveProperty('email', testGoogleUser.email);
      expect(res.body.data.user).toHaveProperty('name', 'wahyutraveler');

      registeredUserId = res.body.data.user.id;

      // Verify Database records
      const savedUser = await prisma.user.findUnique({
        where: { id: registeredUserId },
        include: { identities: true },
      });

      expect(savedUser).toBeDefined();
      expect(savedUser?.password).not.toBeNull();
      expect(savedUser?.identities.length).toBe(1);
      expect(savedUser?.identities[0].provider).toBe(AuthProvider.GOOGLE);
      expect(savedUser?.identities[0].providerAccountId).toBe(testGoogleUser.sub);
    });

    it('should allow subsequent login via Email + Password with SAME User ID', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testGoogleUser.email,
        password: 'securePassword@2026',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(registeredUserId);
    });

    it('PHASE 7: should allow login via Username + Password with SAME User ID', async () => {
      // 1. Using { username, password }
      const resUsername = await request(app).post('/api/v1/auth/login').send({
        username: 'wahyutraveler',
        password: 'securePassword@2026',
      });

      expect(resUsername.status).toBe(200);
      expect(resUsername.body.success).toBe(true);
      expect(resUsername.body.data.user.id).toBe(registeredUserId);
      expect(resUsername.body.data.user.name).toBe('wahyutraveler');

      // 2. Using { email: username, password }
      const resEmailAsUsername = await request(app).post('/api/v1/auth/login').send({
        email: 'wahyutraveler',
        password: 'securePassword@2026',
      });

      expect(resEmailAsUsername.status).toBe(200);
      expect(resEmailAsUsername.body.success).toBe(true);
      expect(resEmailAsUsername.body.data.user.id).toBe(registeredUserId);
    });

    it('should allow subsequent login via Google Sign-In with SAME User ID (CASE A)', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: testGoogleUser.sub,
        email: testGoogleUser.email,
        name: testGoogleUser.name,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_subsequent' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('LOGIN_SUCCESS');
      expect(res.body.data.user.id).toBe(registeredUserId);
    });
  });

  describe('5. Single-Account Linking (Existing Password User -> Google Sign-In)', () => {
    let passwordUserId: string;

    it('should register a standard Password user first', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: existingPasswordUser.email,
        password: existingPasswordUser.password,
        name: existingPasswordUser.name,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      passwordUserId = res.body.data.user.id;
    });

    it('should automatically link Google AuthIdentity to the SAME User ID when logging in with same email', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: existingPasswordUser.googleSub,
        email: existingPasswordUser.email,
        name: existingPasswordUser.name,
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_for_linking' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('LOGIN_SUCCESS');
      expect(res.body.data.user.id).toBe(passwordUserId);

      // Verify that the user in DB now has the GOOGLE identity linked
      const userInDb = await prisma.user.findUnique({
        where: { id: passwordUserId },
        include: { identities: true },
      });

      expect(userInDb?.identities.length).toBe(1);
      expect(userInDb?.identities[0].provider).toBe(AuthProvider.GOOGLE);
      expect(userInDb?.identities[0].providerAccountId).toBe(existingPasswordUser.googleSub);
    });

    it('should allow login via password and login via Google resulting in identical User ID', async () => {
      // 1. Login via Password
      const passLoginRes = await request(app).post('/api/v1/auth/login').send({
        email: existingPasswordUser.email,
        password: existingPasswordUser.password,
      });
      expect(passLoginRes.body.data.user.id).toBe(passwordUserId);

      // 2. Login via Google
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: existingPasswordUser.googleSub,
        email: existingPasswordUser.email,
        name: existingPasswordUser.name,
        isEmailVerified: true,
      });

      const googleLoginRes = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_check' });
      expect(googleLoginRes.body.data.user.id).toBe(passwordUserId);
    });
  });

  describe('6. Account Status Enforcement for Google Login', () => {
    it('should reject login for SUSPENDED user account with 403', async () => {
      // Create suspended user with linked Google identity
      const suspendedUser = await prisma.user.create({
        data: {
          email: 'suspended.google@example.com',
          name: 'Suspended Google User',
          status: UserStatus.SUSPENDED,
          role: UserRole.USER,
          identities: {
            create: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: 'sub_suspended_google_999',
            },
          },
        },
      });

      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: 'sub_suspended_google_999',
        email: suspendedUser.email,
        name: suspendedUser.name,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'mock_token_suspended' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('7. Phase 8 — Google Account Linking (POST /api/v1/auth/google/link)', () => {
    let userToken = '';
    const linkUserEmail = 'user.for.linking@example.com';
    const linkUserPassword = 'Password123!';
    const linkUserGoogleSub = 'sub_linking_unique_12345';

    beforeAll(async () => {
      // Clean up previous test data if any
      await prisma.authIdentity.deleteMany({
        where: { providerAccountId: { in: [linkUserGoogleSub, 'sub_already_taken_999'] } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [linkUserEmail, 'other.google.owner@example.com'] } },
      });

      // Register clean user
      const res = await request(app).post('/api/v1/auth/register').send({
        email: linkUserEmail,
        password: linkUserPassword,
        name: 'User For Linking',
      });
      userToken = res.body.data.accessToken;
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google/link')
        .send({ idToken: 'some_token' });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should successfully link Google account to authenticated user', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: linkUserGoogleSub,
        email: linkUserEmail,
        name: 'User For Linking',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ idToken: 'valid_link_token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Google account linked successfully');

      // Verify in DB
      const identity = await prisma.authIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: linkUserGoogleSub,
          },
        },
      });
      expect(identity).toBeDefined();
    });

    it('should reject linking when Google account is already linked to ANOTHER user (409 Conflict)', async () => {
      // Create another user
      const otherUserRes = await request(app).post('/api/v1/auth/register').send({
        email: 'other.google.owner@example.com',
        password: 'Password123!',
        name: 'Other Google Owner',
      });
      const otherUserToken = otherUserRes.body.data.accessToken;

      // Try to link the SAME Google sub that belongs to linkUserEmail
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: linkUserGoogleSub,
        email: linkUserEmail,
        name: 'Other User',
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ idToken: 'valid_link_token_already_taken' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('GOOGLE_ACCOUNT_ALREADY_LINKED');
      expect(res.body.message).toBe('Google account is already linked to another user');
    });
  });

  describe('8. Phase 9 — Unlink Google (DELETE /api/v1/auth/google/link)', () => {
    let dualUserToken = '';
    let googleOnlyUserToken = '';
    const dualUserEmail = 'dual.unlink.test@example.com';
    const googleOnlyEmail = 'google.only.user@example.com';
    const googleOnlySub = 'sub_google_only_cannot_unlink';

    beforeAll(async () => {
      // Clean up
      await prisma.authIdentity.deleteMany({
        where: { providerAccountId: { in: ['sub_dual_unlink_888', googleOnlySub] } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [dualUserEmail, googleOnlyEmail] } },
      });

      // 1. Dual user (has password + Google)
      const dualRes = await request(app).post('/api/v1/auth/register').send({
        email: dualUserEmail,
        password: 'Password123!',
        name: 'Dual Unlink User',
      });
      dualUserToken = dualRes.body.data.accessToken;

      // Link Google to dual user
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: 'sub_dual_unlink_888',
        email: dualUserEmail,
        name: 'Dual Unlink User',
        isEmailVerified: true,
      });
      await request(app)
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${dualUserToken}`)
        .send({ idToken: 'mock_token' });

      // 2. Google-only user (has password = null)
      const googleOnlyUser = await prisma.user.create({
        data: {
          email: googleOnlyEmail,
          name: 'Google Only User',
          password: null,
          isEmailVerified: true,
          role: UserRole.USER,
          identities: {
            create: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: googleOnlySub,
            },
          },
        },
      });

      // Create token for google-only user
      const { authService } = await import('../src/modules/auth/auth.service');
      const tokens = (authService as unknown as { generateTokens: (u: typeof googleOnlyUser) => { accessToken: string } }).generateTokens(googleOnlyUser);
      googleOnlyUserToken = tokens.accessToken;
    });

    it('should reject unlinking when Google is the ONLY auth method (no password)', async () => {
      const res = await request(app)
        .delete('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${googleOnlyUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ONLY_AUTH_METHOD');
      expect(res.body.message).toBe('Cannot unlink the only authentication method');
    });

    it('should successfully unlink Google when user also has a password', async () => {
      const res = await request(app)
        .delete('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${dualUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Google account unlinked successfully');

      // Verify Google identity was deleted from DB
      const identity = await prisma.authIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: 'sub_dual_unlink_888',
          },
        },
      });
      expect(identity).toBeNull();
    });
  });

  describe('9. Phase 10 — Auth Providers (GET /api/v1/auth/providers)', () => {
    let testUserToken = '';
    const provEmail = 'providers.test@example.com';
    const provSub = 'sub_providers_test_777';

    beforeAll(async () => {
      await prisma.authIdentity.deleteMany({
        where: { providerAccountId: provSub },
      });
      await prisma.user.deleteMany({
        where: { email: provEmail },
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        email: provEmail,
        password: 'Password123!',
        name: 'Providers Test User',
      });
      testUserToken = res.body.data.accessToken;
    });

    it('should return password: true, google: false before linking Google', async () => {
      const res = await request(app)
        .get('/api/v1/auth/providers')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        password: true,
        google: false,
      });
    });

    it('should return password: true, google: true after linking Google', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: provSub,
        email: provEmail,
        name: 'Providers Test User',
        isEmailVerified: true,
      });

      await request(app)
        .post('/api/v1/auth/google/link')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ idToken: 'token_for_providers_test' });

      const res = await request(app)
        .get('/api/v1/auth/providers')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        password: true,
        google: true,
      });
    });
  });
});

