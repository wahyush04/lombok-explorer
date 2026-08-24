import { createApp } from './app';
import { config } from './config/config';
import { logger } from './common/utils/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import http from 'node:http';

const startServer = async (): Promise<void> => {
  try {
    // 1. Attempt database connection on bootstrap
    try {
      await connectDatabase();
    } catch {
      logger.warn(
        '⚠️ Starting server without initial active database connection (offline/dev mode)',
      );
    }

    // 2. Instantiate application
    const app = createApp();
    const server = http.createServer(app);

    // 3. Configure HTTP keep-alive timeouts for reverse proxies (Nginx, AWS ALB, Cloudflare)
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // 4. Start HTTP Listener
    server.listen(config.app.port, config.app.host, () => {
      logger.info(
        `🚀 Lombok Explorer API running on http://${config.app.host}:${config.app.port} [${config.app.env}]`,
      );
      logger.info(
        `📖 Swagger API Documentation available at http://${config.app.host}:${config.app.port}/api/docs`,
      );
      logger.info(`🩺 Health check endpoint: http://${config.app.host}:${config.app.port}/health`);
      logger.info(
        `🚦 Readiness probe endpoint: http://${config.app.host}:${config.app.port}/health/ready`,
      );
    });

    // 5. Graceful Shutdown handlers
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      // Stop accepting new HTTP connections
      server.close(async () => {
        logger.info('HTTP server closed, all in-flight connections drained.');
        try {
          await disconnectDatabase();
          logger.info('Database connections closed cleanly.');
        } catch (dbErr) {
          logger.error({ err: dbErr }, 'Error during database disconnection.');
        }
        logger.info('Lombok Explorer API shutdown completed successfully.');
        process.exit(0);
      });

      // Force terminate if graceful shutdown exceeds 10s deadline
      const forceShutdownTimer = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded (10s). Forcefully terminating process.');
        process.exit(1);
      }, 10000);

      if (forceShutdownTimer.unref) {
        forceShutdownTimer.unref();
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error({ err: reason }, 'Unhandled Promise Rejection caught in root process');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.fatal(
        { err: error },
        'Uncaught Exception detected in root process. Initiating immediate emergency exit.',
      );
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to bootstrap Lombok Explorer API');
    process.exit(1);
  }
};

void startServer();
