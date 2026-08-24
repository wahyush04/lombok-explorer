import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';

export const httpLoggerMiddleware = pinoHttp({
  logger,
  genReqId: (req: Request) => req.id || (req.headers['x-request-id'] as string) || 'unknown-id',
  customLogLevel: (_req: Request, res: Response, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: Request, res: Response) => {
    return `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}`;
  },
  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}: ${err.message}`;
  },
  customProps: (req: Request, _res: Response) => ({
    requestId: req.id,
  }),
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  autoLogging: {
    ignore: (req: Request) => {
      // Don't clutter logs with high-frequency health checks or static docs
      const url = req.originalUrl || req.url || '';
      return url.includes('/health') || url.startsWith('/docs');
    },
  },
});
