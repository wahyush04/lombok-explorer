import { Request, Response } from 'express';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { config } from '../../config/config';
import { checkDatabaseHealth } from '../../database/prisma';

export class HealthController {
  /**
   * Simple health check endpoint returning { "status": "ok" }
   * Useful for load balancers and lightweight health probes.
   */
  public static getHealthSimple(_req: Request, res: Response): void {
    res.status(200).json({ status: 'ok' });
  }

  /**
   * Detailed health check endpoint with system metrics and database status
   */
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();

    const isDbHealthy = await checkDatabaseHealth();

    const healthData = {
      status: 'UP',
      healthStatus: 'ok',
      service: config.app.name,
      version: config.app.version,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptimeSeconds)}s`,
      environment: config.app.env,
      database: isDbHealthy ? 'healthy' : 'disconnected',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
    };

    ResponseUtil.sendSuccess(res, healthData, 'System is healthy');
  }

  /**
   * Readiness check endpoint for Kubernetes / container orchestration.
   * Verifies that all downstream dependencies (e.g. Database) are ready to accept traffic.
   */
  public static async getReadiness(_req: Request, res: Response): Promise<void> {
    const isDbHealthy = await checkDatabaseHealth();

    if (!isDbHealthy) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        message: 'Service unavailable: database is not ready',
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      uptime: Math.floor(process.uptime()),
    });
  }

  /**
   * Liveness probe endpoint for Kubernetes / container restart decisions.
   */
  public static getLiveness(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
    });
  }
}
