import { describe, it, expect } from 'vitest';
import { validateEnv } from '../src/config/env';

describe('Environment Variable Validation (Zod)', () => {
  const validBaseEnv = {
    NODE_ENV: 'development',
    PORT: '8080',
    DATABASE_URL: 'mysql://root:root@localhost:3306/lombok_explorer',
    JWT_ACCESS_SECRET: 'lombok_super_secret_access_key_12345',
    JWT_REFRESH_SECRET: 'lombok_super_secret_refresh_key_12345',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    CORS_ORIGIN: '*',
  };

  it('should successfully validate and parse valid environment variables', () => {
    const parsed = validateEnv(validBaseEnv);

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(8080);
    expect(parsed.DATABASE_URL).toBe('mysql://root:root@localhost:3306/lombok_explorer');
    expect(parsed.JWT_ACCESS_SECRET).toBe('lombok_super_secret_access_key_12345');
    expect(parsed.JWT_REFRESH_SECRET).toBe('lombok_super_secret_refresh_key_12345');
    expect(parsed.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(parsed.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    expect(parsed.CORS_ORIGIN).toBe('*');
  });

  it('should populate default values for optional environment variables', () => {
    const minimalEnv = {
      DATABASE_URL: 'mysql://root:root@localhost:3306/lombok_explorer',
      JWT_ACCESS_SECRET: 'lombok_super_secret_access_key_12345',
      JWT_REFRESH_SECRET: 'lombok_super_secret_refresh_key_12345',
    };

    const parsed = validateEnv(minimalEnv);

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(8080);
    expect(parsed.API_PREFIX).toBe('/api/v1');
    expect(parsed.HOST).toBe('0.0.0.0');
    expect(parsed.JWT_ACCESS_EXPIRES_IN).toBe('1h');
    expect(parsed.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    expect(parsed.CORS_ORIGIN).toBe('*');
    expect(parsed.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(parsed.RATE_LIMIT_MAX).toBe(100);
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.CLOUDINARY_FOLDER).toBe('lombok-explorer');
  });

  it('should fail validation when DATABASE_URL is missing', () => {
    const invalidEnv = {
      ...validBaseEnv,
      DATABASE_URL: undefined,
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/DATABASE_URL/);
  });

  it('should fail validation when JWT_ACCESS_SECRET is missing', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_ACCESS_SECRET: undefined,
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/JWT_ACCESS_SECRET/);
  });

  it('should fail validation when JWT_ACCESS_SECRET is shorter than 16 characters', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_ACCESS_SECRET: 'short_key',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/at least 16 ch/);
  });

  it('should fail validation when JWT_REFRESH_SECRET is shorter than 16 characters', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_REFRESH_SECRET: 'short_key',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/at least 16 ch/);
  });

  it('should fail validation when PORT is invalid or out of range', () => {
    const invalidEnv = {
      ...validBaseEnv,
      PORT: '99999',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/PORT/);
  });

  it('should fail validation when NODE_ENV is invalid', () => {
    const invalidEnv = {
      ...validBaseEnv,
      NODE_ENV: 'invalid_env_mode',
    };

    expect(() => validateEnv(invalidEnv)).toThrowError(/NODE_ENV/);
  });
});
