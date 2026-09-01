import { env } from './env';

export const config = {
  app: {
    name: 'Lombok Explorer API',
    version: '1.0.0',
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    host: env.HOST,
    apiPrefix: env.API_PREFIX,
  },
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },
  logger: {
    level: env.LOG_LEVEL,
  },
  weather: {
    apiKey: env.WEATHER_API_KEY,
    baseUrl: env.WEATHER_API_BASE_URL,
    cacheTtlSeconds: env.WEATHER_CACHE_TTL_SECONDS,
  },
  adminSeed: {
    email: env.ADMIN_EMAIL || 'admin@lombokexplorer.com',
    password: env.ADMIN_PASSWORD || 'Password123!',
    name: env.ADMIN_NAME || 'Super Admin Lombok Explorer',
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    projectId: env.GOOGLE_PROJECT_ID,
  },
  mapbox: {
    accessToken: env.MAPBOX_SECRET_TOKEN || env.MAPBOX_ACCESS_TOKEN || env.MAPBOX_PUBLIC_TOKEN || '',
    publicToken: env.MAPBOX_PUBLIC_TOKEN || env.MAPBOX_ACCESS_TOKEN || '',
    secretToken: env.MAPBOX_SECRET_TOKEN || '',
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    folder: env.CLOUDINARY_FOLDER || 'lombok-explorer',
    isConfigured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },
} as const;

export type AppConfig = typeof config;
