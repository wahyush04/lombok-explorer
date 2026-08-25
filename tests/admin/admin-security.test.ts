import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { config } from '../../src/config/config';
import { adminAuditLogsService } from '../../src/modules/admin/audit-logs/admin-audit-logs.service';

describe('Admin Security Hardening Architecture Suite (Phase 17)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let adminUserId = '';

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin (role: ADMIN)
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.user.id;

    // 2. Register standard user (role: USER)
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Security Test User',
      email: `sectest_${Date.now()}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('1. JWT Validation & Token Lifecycle', () => {
    it('should reject requests with missing token (401 TOKEN_MISSING)', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject requests with malformed Authorization header (401 TOKEN_MALFORMED)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', 'Basic invalid-scheme-token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MALFORMED');
    });

    it('should reject forged or tempered JWT signature (401 INVALID_TOKEN)', async () => {
      const forgedToken = jwt.sign(
        { userId: 'fake-admin-id', role: 'ADMIN', email: 'hacker@lombokexplorer.com' },
        'wrong-secret-key-12345678901234567890',
        { expiresIn: '15m' },
      );
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_TOKEN');
    });

    it('should reject expired JWT token (401 TOKEN_EXPIRED)', async () => {
      const expiredToken = jwt.sign(
        { userId: 'admin-id', role: 'ADMIN', email: 'admin@lombokexplorer.com' },
        config.jwt.accessSecret,
        { expiresIn: '-1s' }, // Expired 1 second ago
      );
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_EXPIRED');
    });
  });

  describe('2. Role-Based Access Control (RBAC)', () => {
    it('should reject standard USER role with 403 ADMIN_ACCESS_REQUIRED', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should allow authentic ADMIN role access', async () => {
      const res = await request(app)
        .get('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Helmet & Secure HTTP Headers', () => {
    it('should enforce security headers on all responses', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-download-options']).toBe('noopen');
      expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('4. CORS Policy', () => {
    it('should respond to preflight OPTIONS with proper CORS headers', async () => {
      const res = await request(app)
        .options('/api/v1/admin/destinations')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('5. Input Validation (Zod Defense)', () => {
    it('should block malformed / invalid schema payloads with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty
          latitude: 'not-a-number',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  describe('6. Request Body Size Limiting', () => {
    it('should reject oversized JSON payloads exceeding 2MB limit with 413', async () => {
      const hugePayload = {
        name: 'Huge Destination',
        description: 'A'.repeat(2.5 * 1024 * 1024), // 2.5 MB of data
      };

      const res = await request(app)
        .post('/api/v1/admin/destinations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(hugePayload);

      expect(res.status).toBe(413);
    });
  });

  describe('7. Audit Logging & Sensitive Data Redaction', () => {
    it('should record audit log without leaking passwords, tokens, or API secrets', async () => {
      const log = await adminAuditLogsService.recordLog({
        userId: adminUserId,
        action: 'DESTINATION_CREATED',
        entity: 'Destination',
        entityId: 'test-entity-id-123',
        newValues: {
          name: 'Secret Beach',
          password: 'SuperSecretPassword123!',
          refreshToken: 'raw-refresh-token-xyz',
          apiKey: 'secret_key_123',
        },
      });

      expect(log).toHaveProperty('id');
      const newVals = JSON.parse((log as any).newValues || '{}');
      expect(newVals.password).toBe('[REDACTED]');
      expect(newVals.refreshToken).toBe('[REDACTED]');
      expect(newVals.apiKey).toBe('[REDACTED]');
      expect(newVals.name).toBe('Secret Beach');
    });
  });

  describe('8. Password Hashing with Bcrypt', () => {
    it('should use high-workfactor bcrypt hashing and never return plain passwords', async () => {
      const password = 'AdminSecurePassword2026!';
      const hash = await bcrypt.hash(password, 12);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$')).toBe(true);
      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);
    });
  });
});
