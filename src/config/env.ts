import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .union([z.string(), z.number()])
    .default('8080')
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error('PORT must be a valid port number between 1 and 65535');
      }
      return parsed;
    }),
  API_PREFIX: z.string().default('/api/v1'),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z
    .string({
      required_error: 'DATABASE_URL is a required environment variable',
    })
    .min(1, 'DATABASE_URL cannot be empty'),

  JWT_ACCESS_SECRET: z
    .string({
      required_error: 'JWT_ACCESS_SECRET is a required environment variable',
    })
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long for security'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  JWT_REFRESH_SECRET: z
    .string({
      required_error: 'JWT_REFRESH_SECRET is a required environment variable',
    })
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long for security'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),

  RATE_LIMIT_WINDOW_MS: z
    .union([z.string(), z.number()])
    .default('900000')
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1000) {
        throw new Error('RATE_LIMIT_WINDOW_MS must be at least 1000ms');
      }
      return parsed;
    }),
  RATE_LIMIT_MAX: z
    .union([z.string(), z.number()])
    .default('100')
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('RATE_LIMIT_MAX must be a positive integer');
      }
      return parsed;
    }),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  WEATHER_API_KEY: z.string().default('e98c7ab33f21494199425936251005'),
  WEATHER_API_BASE_URL: z.string().url().default('https://api.weatherapi.com/v1'),
  WEATHER_CACHE_TTL_SECONDS: z
    .union([z.string(), z.number()])
    .default('600')
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error('WEATHER_CACHE_TTL_SECONDS must be a non-negative integer');
      }
      return parsed;
    }),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),
  ADMIN_NAME: z.string().optional().default('Super Admin Lombok Explorer'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env;

export const validateEnv = (customEnv?: NodeJS.ProcessEnv | Record<string, unknown>): Env => {
  const envToValidate = customEnv || process.env;
  const result = envSchema.safeParse(envToValidate);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`Invalid environment variables: ${errorDetails}`);
  }

  if (!customEnv) {
    validatedEnv = result.data;
  }
  return result.data;
};

export const getEnv = (): Env => {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
};

export const env: Env = validateEnv();
