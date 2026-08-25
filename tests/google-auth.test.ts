import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';
import { AuthProvider, UserRole, UserStatus } from '@prisma/client';
import { googleAuthService } from '../src/modules/auth/google-auth.service';

describe('Google Authentication & Single Account Linking (Phase 4)', () => {
  let app: Application;

  const testGoogleUser = {
    email: 'google.traveler@example.com',
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

  describe('3. Google Login - CASE C (New User Registration via Google)', () => {
    it('should create new User and AuthIdentity when user does not exist', async () => {
      // Mock Google Token Verification
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
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body.data).toHaveProperty('status', 'LOGIN_SUCCESS');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('tokenType', 'Bearer');
      expect(res.body.data.user).toHaveProperty('email', testGoogleUser.email);
      expect(res.body.data.user).toHaveProperty('name', testGoogleUser.name);
      expect(res.body.data.user).toHaveProperty('isEmailVerified', true);

      // Verify Database records
      const savedUser = await prisma.user.findUnique({
        where: { email: testGoogleUser.email },
        include: { identities: true },
      });

      expect(savedUser).toBeDefined();
      expect(savedUser?.identities.length).toBe(1);
      expect(savedUser?.identities[0].provider).toBe(AuthProvider.GOOGLE);
      expect(savedUser?.identities[0].providerAccountId).toBe(testGoogleUser.sub);
    });
  });

  describe('4. Google Login - CASE A (Already Linked Google Identity)', () => {
    it('should find existing AuthIdentity and return login success', async () => {
      // Mock Google Token Verification returning the same sub
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: testGoogleUser.sub,
        email: testGoogleUser.email,
        name: testGoogleUser.name,
        avatarUrl: testGoogleUser.avatarUrl,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_existing' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'LOGIN_SUCCESS');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).toHaveProperty('email', testGoogleUser.email);
    });
  });

  describe('5. Google Login - CASE B (Account Linking to Existing Password User)', () => {
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

    it('should link Google AuthIdentity to the SAME User ID when logging in with same email', async () => {
      // Mock Google Token Verification with same email as password user
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
      // CRITICAL REQUIREMENT: Must produce the exact same User ID!
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

    it('should allow subsequent login via Username/Email + Password with SAME User ID', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: existingPasswordUser.email,
        password: existingPasswordUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(passwordUserId);
    });

    it('should allow subsequent login via Google with SAME User ID', async () => {
      vi.spyOn(googleAuthService, 'verifyIdToken').mockResolvedValueOnce({
        sub: existingPasswordUser.googleSub,
        email: existingPasswordUser.email,
        name: existingPasswordUser.name,
        isEmailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid_mock_google_id_token_subsequent' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('LOGIN_SUCCESS');
      expect(res.body.data.user.id).toBe(passwordUserId);
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
});
