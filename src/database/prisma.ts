import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';
import { logger } from '../common/utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
    log: config.app.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

if (config.app.isDevelopment) {
  global.__prisma = prisma;
}

// Handle Prisma database logging/events
interface PrismaEventEmitter {
  $on?: (event: 'error' | 'warn' | 'info' | 'query', cb: (e: unknown) => void) => void;
}

(prisma as unknown as PrismaEventEmitter).$on?.('error', (e: unknown) => {
  logger.error({ err: e }, 'Prisma Database Error');
});

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected cleanly');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from database');
  }
};
