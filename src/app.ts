import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yaml';
import fs from 'node:fs';
import path from 'node:path';

import { config } from './config/config';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { httpLoggerMiddleware } from './common/middleware/logger.middleware';
import { notFoundMiddleware } from './common/middleware/not-found.middleware';
import { errorHandlerMiddleware } from './common/middleware/error.middleware';
import { generalLimiter } from './common/middleware/rate-limit.middleware';
import { apiRoutes } from './routes';
import { ResponseUtil } from './common/utils/api-response.util';
import { HealthController } from './modules/health/health.controller';
import { asyncHandler } from './common/utils/async-handler.util';

export const createApp = (): Application => {
  const app: Application = express();

  // 1. Trust proxy (for load balancers, Docker, reverse proxies)
  app.set('trust proxy', 1);

  // 2. Security HTTP Headers (Phase 20 - Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to render assets properly
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows images to be loaded by frontend apps
      crossOriginEmbedderPolicy: false,
      xContentTypeOptions: true,
      xDnsPrefetchControl: true,
      xFrameOptions: { action: 'sameorigin' },
      hidePoweredBy: true,
      hsts: config.app.isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // 3. CORS configuration (Phase 20 - CORS)
  app.use(
    cors({
      origin: config.cors.origin === '*' ? '*' : config.cors.origin.split(','),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
    }),
  );

  // 4. Rate Limiting (Phase 20 - Global Rate Limiter)
  app.use(generalLimiter);

  // 5. Request correlation ID & HTTP Logger
  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);

  // 6. Request Size Limiters (Phase 20 - Request payload body size limit)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 7. Static Asset Serving for /assets/image (Phase 19)
  const assetsDir = path.resolve(process.cwd(), 'assets');
  const imageDir = path.join(assetsDir, 'image');
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }
  app.use('/assets', express.static(assetsDir));

  // 8. Swagger Documentation UI (Public: /api/docs, Admin: /api/docs/admin)
  try {
    const openApiPath = path.resolve(process.cwd(), 'openapi.yaml');
    const adminOpenApiPath = path.resolve(process.cwd(), 'openapi-admin.yaml');

    // 8a. Admin OpenAPI Documentation (/api/docs/admin)
    if (fs.existsSync(adminOpenApiPath)) {
      const adminFileContent = fs.readFileSync(adminOpenApiPath, 'utf8');
      const adminSwaggerDoc = yaml.parse(adminFileContent);

      const adminUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle: 'Lombok Explorer Admin API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get('/api/docs/admin/json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(adminSwaggerDoc);
      });
      app.get('/api/docs/admin/yaml', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(adminFileContent);
      });

      app.use(
        '/api/docs/admin',
        swaggerUi.serveFiles(adminSwaggerDoc, adminUiOptions),
        swaggerUi.setup(adminSwaggerDoc, adminUiOptions),
      );
      app.use(
        '/docs/admin',
        swaggerUi.serveFiles(adminSwaggerDoc, adminUiOptions),
        swaggerUi.setup(adminSwaggerDoc, adminUiOptions),
      );
    }

    const authOpenApiPath = path.resolve(process.cwd(), 'openapi-auth.yaml');

    // 8b. Auth OpenAPI Documentation (/api/docs/auth)
    if (fs.existsSync(authOpenApiPath)) {
      const authFileContent = fs.readFileSync(authOpenApiPath, 'utf8');
      const authSwaggerDoc = yaml.parse(authFileContent);

      const authUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle: 'Lombok Explorer Auth API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #eff6ff; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get('/api/docs/auth/json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(authSwaggerDoc);
      });
      app.get('/api/docs/auth/yaml', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(authFileContent);
      });

      app.use(
        '/api/docs/auth',
        swaggerUi.serveFiles(authSwaggerDoc, authUiOptions),
        swaggerUi.setup(authSwaggerDoc, authUiOptions),
      );
      app.use(
        '/docs/auth',
        swaggerUi.serveFiles(authSwaggerDoc, authUiOptions),
        swaggerUi.setup(authSwaggerDoc, authUiOptions),
      );
    }

    const feedOpenApiPath = path.resolve(process.cwd(), 'openapi-feed.yaml');

    // 8c. Feed & Community OpenAPI Documentation (/api/docs/feed & /api/docs/feeds)
    if (fs.existsSync(feedOpenApiPath)) {
      const feedFileContent = fs.readFileSync(feedOpenApiPath, 'utf8');
      const feedSwaggerDoc = yaml.parse(feedFileContent);

      const feedUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle: 'Lombok Explorer Feed & Community API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #ecfdf5; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get(['/api/docs/feed/json', '/api/docs/feeds/json'], (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(feedSwaggerDoc);
      });
      app.get(['/api/docs/feed/yaml', '/api/docs/feeds/yaml'], (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(feedFileContent);
      });

      app.use(
        ['/api/docs/feed', '/api/docs/feeds'],
        swaggerUi.serveFiles(feedSwaggerDoc, feedUiOptions),
        swaggerUi.setup(feedSwaggerDoc, feedUiOptions),
      );
      app.use(
        ['/docs/feed', '/docs/feeds'],
        swaggerUi.serveFiles(feedSwaggerDoc, feedUiOptions),
        swaggerUi.setup(feedSwaggerDoc, feedUiOptions),
      );
    }

    const itineraryOpenApiPath = path.resolve(process.cwd(), 'openapi-itinerary.yaml');

    // 8d. Itinerary / Trip OpenAPI Documentation (/api/docs/itinerary & /api/docs/itineraries)
    if (fs.existsSync(itineraryOpenApiPath)) {
      const itineraryFileContent = fs.readFileSync(itineraryOpenApiPath, 'utf8');
      const itinerarySwaggerDoc = yaml.parse(itineraryFileContent);

      const itineraryUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle: 'Lombok Explorer Itinerary & Trip API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #eff6ff; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get('/api/docs/itinerary/json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(itinerarySwaggerDoc);
      });
      app.get('/api/docs/itinerary/yaml', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(itineraryFileContent);
      });

      app.use(
        ['/api/docs/itinerary', '/api/docs/itineraries'],
        swaggerUi.serveFiles(itinerarySwaggerDoc, itineraryUiOptions),
        swaggerUi.setup(itinerarySwaggerDoc, itineraryUiOptions),
      );
      app.use(
        ['/docs/itinerary', '/docs/itineraries'],
        swaggerUi.serveFiles(itinerarySwaggerDoc, itineraryUiOptions),
        swaggerUi.setup(itinerarySwaggerDoc, itineraryUiOptions),
      );
    }

    const exploreOpenApiPath = path.resolve(process.cwd(), 'openapi-explore.yaml');

    // 8e. Destinations, Accommodations & Restaurants OpenAPI Documentation (/api/docs/explore & /api/docs/destinations)
    if (fs.existsSync(exploreOpenApiPath)) {
      const exploreFileContent = fs.readFileSync(exploreOpenApiPath, 'utf8');
      const exploreSwaggerDoc = yaml.parse(exploreFileContent);

      const exploreUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle:
          'Lombok Explorer Destinations, Accommodations & Restaurants API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #f0fdf4; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get(
        [
          '/api/docs/explore/json',
          '/api/docs/explore-json',
          '/api/docs/destinations/json',
          '/api/docs/destinations-json',
        ],
        (_req: Request, res: Response) => {
          res.setHeader('Content-Type', 'application/json');
          res.json(exploreSwaggerDoc);
        },
      );
      app.get(
        [
          '/api/docs/explore/yaml',
          '/api/docs/explore-yaml',
          '/api/docs/destinations/yaml',
          '/api/docs/destinations-yaml',
        ],
        (_req: Request, res: Response) => {
          res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
          res.send(exploreFileContent);
        },
      );

      app.use(
        ['/api/docs/explore', '/api/docs/destinations'],
        swaggerUi.serveFiles(exploreSwaggerDoc, exploreUiOptions),
        swaggerUi.setup(exploreSwaggerDoc, exploreUiOptions),
      );
      app.use(
        ['/docs/explore', '/docs/destinations'],
        swaggerUi.serveFiles(exploreSwaggerDoc, exploreUiOptions),
        swaggerUi.setup(exploreSwaggerDoc, exploreUiOptions),
      );
    }

    // 8f. Public General OpenAPI Documentation (/api/docs)
    if (fs.existsSync(openApiPath)) {
      const fileContent = fs.readFileSync(openApiPath, 'utf8');
      const swaggerDocument = yaml.parse(fileContent);

      const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
        customSiteTitle: 'Lombok Explorer API Documentation',
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 24px; }
          .swagger-ui .scheme-container { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
        `,
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: true,
          tryItOutEnabled: true,
        },
      };

      app.get('/api/docs/json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(swaggerDocument);
      });
      app.get('/api/docs/yaml', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.send(fileContent);
      });
      app.get('/docs-json', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(swaggerDocument);
      });

      app.use(
        '/api/docs',
        swaggerUi.serveFiles(swaggerDocument, swaggerUiOptions),
        swaggerUi.setup(swaggerDocument, swaggerUiOptions),
      );
      app.use(
        '/docs',
        swaggerUi.serveFiles(swaggerDocument, swaggerUiOptions),
        swaggerUi.setup(swaggerDocument, swaggerUiOptions),
      );
    }
  } catch {
    // If documentation fails to load in some environments, app continues
  }

  // 8.5 Root Health, Readiness, & Liveness Endpoints (Phase 25 - Production Readiness)
  app.get('/health', HealthController.getHealthSimple);
  app.get('/health/ready', asyncHandler(HealthController.getReadiness));
  app.get('/health/live', HealthController.getLiveness);

  // 9. Root Welcome endpoint
  app.get('/', (_req: Request, res: Response) => {
    ResponseUtil.sendSuccess(
      res,
      {
        name: config.app.name,
        version: config.app.version,
        environment: config.app.env,
        docs: '/api/docs',
        exploreDocs: '/api/docs/explore',
        authDocs: '/api/docs/auth',
        feedDocs: '/api/docs/feed',
        itineraryDocs: '/api/docs/itinerary',
        adminDocs: '/api/docs/admin',
        docsJson: '/api/docs/json',
        docsYaml: '/api/docs/yaml',
        health: '/health',
        ready: '/health/ready',
        apiV1: `${config.app.apiPrefix}`,
        adminV1: `${config.app.apiPrefix}/admin`,
      },
      'Welcome to Lombok Explorer API',
    );
  });

  // 10. Versioned API Routes (Phase 23)
  // Supports /api/v1 (primary), /v1 (compatibility alias), /api/v2, /v2
  app.use(apiRoutes);

  // 11. 404 Not Found Middleware
  app.use(notFoundMiddleware);

  // 12. Centralized Error Handler Middleware (Phase 20 - Secure error response without stack trace)
  app.use(errorHandlerMiddleware);

  return app;
};
