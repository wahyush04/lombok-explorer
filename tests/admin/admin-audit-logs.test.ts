import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';
import { adminAuditLogsService } from '../../src/modules/admin/audit-logs/admin-audit-logs.service';

describe('Admin Audit Logs API Suite (Phase 13)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let adminUserId = '';
  let sampleAuditLogId = '';

  const testSuffix = Date.now();

  beforeAll(async () => {
    app = createApp();

    // 1. Login Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.user.id;

    // 2. Register regular user for auth tests
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: `Audit Tester ${testSuffix}`,
      email: `audit.tester.${testSuffix}@lombokexplorer.com`,
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;

    // 3. Create a test Category to generate an audit log action
    const catRes = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Audit Test Category ${testSuffix}`,
        description: 'Test Category for Audit Logging verification',
        iconName: 'history',
      });
    const testCatId = catRes.body.data.id;

    // 4. Record sample audit logs with before/after state and sensitive payload
    const log1 = await adminAuditLogsService.recordLog({
      userId: adminUserId,
      action: 'ADMIN_USER_UPDATED',
      entity: 'User',
      entityId: `usr_test_${testSuffix}`,
      oldValues: { name: 'Old Admin Name', role: 'ADMIN', password: 'SecretPassword123!' },
      newValues: { name: 'New Admin Name', role: 'ADMIN', password: 'NewSecretPassword456!' },
      details: { reason: 'Profile maintenance', ip: '127.0.0.1' },
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest/Test-Agent',
    });
    sampleAuditLogId = log1.id;

    await adminAuditLogsService.recordLog({
      userId: adminUserId,
      action: 'USER_SUSPENDED',
      entity: 'User',
      entityId: `usr_target_${testSuffix}`,
      oldValues: { status: 'ACTIVE' },
      newValues: { status: 'SUSPENDED' },
      details: { reason: 'Violated terms of service' },
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest/Test-Agent',
    });

    await adminAuditLogsService.recordLog({
      userId: adminUserId,
      action: 'DESTINATION_CREATED',
      entity: 'Destination',
      entityId: `dst_test_${testSuffix}`,
      newValues: { name: 'Pantai Kuta Lombok', categoryId: testCatId },
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest/Test-Agent',
    });
  });

  describe('GET /api/v1/admin/audit-logs (List & Query Audit Logs)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/audit-logs');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject standard non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated audit logs for administrators (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 5);
      expect(res.body.meta).toHaveProperty('totalPages');

      const firstLog = res.body.data[0];
      expect(firstLog).toHaveProperty('id');
      expect(firstLog).toHaveProperty('action');
      expect(firstLog).toHaveProperty('resource');
      expect(firstLog).toHaveProperty('entity');
      expect(firstLog).toHaveProperty('timestamp');
      expect(firstLog).toHaveProperty('createdAt');
      expect(firstLog).toHaveProperty('ipAddress');
      expect(firstLog).toHaveProperty('userAgent');
    });

    it('should filter audit logs by action (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action=USER_SUSPENDED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((log: any) => log.action.includes('USER_SUSPENDED'))).toBe(true);
    });

    it('should filter audit logs by resource / entity (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?resource=Destination')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((log: any) => log.entity === 'Destination')).toBe(true);
    });

    it('should filter audit logs by admin user ID (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs?adminId=${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((log: any) => log.userId === adminUserId)).toBe(true);
    });

    it('should filter audit logs by date range (200 OK)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs?startDate=${today}&endDate=${today}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should support general search query across action, entity, details (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs?search=${testSuffix}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/admin/audit-logs/:id (Get Audit Log Detail & Redaction)', () => {
    it('should return 404 for non-existent audit log ID', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs/non_existent_log_id_123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('AUDIT_LOG_NOT_FOUND');
    });

    it('should return audit log detail with redacted sensitive passwords/tokens (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/audit-logs/${sampleAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(sampleAuditLogId);
      expect(res.body.data.action).toBe('ADMIN_USER_UPDATED');
      expect(res.body.data.entity).toBe('User');
      expect(res.body.data.user).not.toBeNull();
      expect(res.body.data.user).toHaveProperty('email');

      // Verify before and after state diffs
      expect(res.body.data.before).toHaveProperty('name', 'Old Admin Name');
      expect(res.body.data.after).toHaveProperty('name', 'New Admin Name');

      // CRITICAL: Verify passwords/secrets are redacted and NEVER stored/exposed in plaintext
      expect(res.body.data.before.password).toBe('[REDACTED]');
      expect(res.body.data.after.password).toBe('[REDACTED]');
    });
  });
});
