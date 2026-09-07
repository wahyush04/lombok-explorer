import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('System & Error Localization Integration', () => {
  const app = createApp();

  it('should return Vary: Accept-Language header on responses', async () => {
    const res = await request(app).get('/');
    expect(res.headers['vary']).toContain('Accept-Language');
  });

  it('should return localized 404 error message in Indonesian by default', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-for-testing');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.message).toContain('tidak ditemukan');
  });

  it('should return localized 404 error message in English when Accept-Language is en-US', async () => {
    const res = await request(app)
      .get('/api/v1/non-existent-route-for-testing')
      .set('Accept-Language', 'en-US');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.message).toContain('not found');
  });

  it('should return stable validation codes and localized messages in Indonesian', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Accept-Language', 'id-ID')
      .send({ email: 'not-an-email' }); // missing password, invalid email

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Data yang dikirimkan tidak valid');
    expect(Array.isArray(res.body.errors)).toBe(true);

    const emailError = res.body.errors.find((e: { field: string }) => e.field === 'email');
    expect(emailError).toBeDefined();
    expect(emailError.code).toBe('INVALID_EMAIL');
    expect(emailError.message).toBe('Format email tidak valid');

    const passwordError = res.body.errors.find((e: { field: string }) => e.field === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError.code).toBe('REQUIRED_FIELD');
    expect(passwordError.message).toBe('Field password wajib diisi');
  });

  it('should return stable validation codes and localized messages in English', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Accept-Language', 'en-US')
      .send({ email: 'not-an-email' }); // missing password, invalid email

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Invalid input data');
    expect(Array.isArray(res.body.errors)).toBe(true);

    const emailError = res.body.errors.find((e: { field: string }) => e.field === 'email');
    expect(emailError).toBeDefined();
    expect(emailError.code).toBe('INVALID_EMAIL');
    expect(emailError.message).toBe('Invalid email format');

    const passwordError = res.body.errors.find((e: { field: string }) => e.field === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError.code).toBe('REQUIRED_FIELD');
    expect(passwordError.message).toBe('Field password is required');
  });
});
