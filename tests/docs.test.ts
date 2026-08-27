import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';

describe('OpenAPI & Swagger UI Integration (Phase 6)', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /api/docs/ should serve Swagger UI HTML', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Lombok Explorer API Documentation');
  });

  it('GET /docs/ should also serve Swagger UI HTML (convenience alias)', async () => {
    const response = await request(app).get('/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('GET /api/docs/json should serve parsed OpenAPI 3.0.3 specification JSON', async () => {
    const response = await request(app).get('/api/docs/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('openapi', '3.0.3');
    expect(response.body.info).toHaveProperty('title', 'Lombok Explorer API');
    expect(response.body).toHaveProperty('paths');
    expect(response.body).toHaveProperty('components');

    // Verify critical endpoints exist in OpenAPI contract
    const paths = response.body.paths;
    expect(paths).toHaveProperty('/health');
    expect(paths).toHaveProperty('/health/live');
    expect(paths).toHaveProperty('/auth/register');
    expect(paths).toHaveProperty('/auth/login');
    expect(paths).toHaveProperty('/auth/google');
    expect(paths).toHaveProperty('/auth/google/register');
    expect(paths).toHaveProperty('/auth/google/link');
    expect(paths).toHaveProperty('/auth/providers');
    expect(paths).toHaveProperty('/auth/refresh-token');
    expect(paths).toHaveProperty('/auth/me');
    expect(paths).toHaveProperty('/auth/logout');
    expect(paths).toHaveProperty('/users/me');
    expect(paths).toHaveProperty('/users/username/check');
    expect(paths).toHaveProperty('/destinations');
    expect(paths).toHaveProperty('/destinations/{id}');
    expect(paths).toHaveProperty('/destinations/featured');
    expect(paths).toHaveProperty('/destinations/nearby');
    expect(paths).toHaveProperty('/destinations/search');
    expect(paths).toHaveProperty('/categories');
    expect(paths).toHaveProperty('/itineraries');
    expect(paths).toHaveProperty('/itineraries/generate');
    expect(paths).toHaveProperty('/recommendations');
    expect(paths).toHaveProperty('/weather');
    expect(paths).toHaveProperty('/restaurants');
    expect(paths).toHaveProperty('/accommodations');
    expect(paths).toHaveProperty('/expenses');
    expect(paths).toHaveProperty('/journals');
    expect(paths).toHaveProperty('/checklists');

    // Verify security scheme
    const securitySchemes = response.body.components.securitySchemes;
    expect(securitySchemes).toHaveProperty('BearerAuth');
    expect(securitySchemes.BearerAuth.type).toBe('http');
    expect(securitySchemes.BearerAuth.scheme).toBe('bearer');
    expect(securitySchemes.BearerAuth.bearerFormat).toBe('JWT');

    // Verify core schemas
    const schemas = response.body.components.schemas;
    expect(schemas).toHaveProperty('UserDto');
    expect(schemas).toHaveProperty('DestinationDto');
    expect(schemas).toHaveProperty('CategoryDto');
    expect(schemas).toHaveProperty('ItineraryDto');
    expect(schemas).toHaveProperty('ReviewDto');
    expect(schemas).toHaveProperty('PaginationMeta');
    expect(schemas).toHaveProperty('ErrorResponse');
    expect(schemas).toHaveProperty('ForbiddenError');
    expect(schemas).toHaveProperty('ActionSuccessResponse');
    expect(schemas).toHaveProperty('GoogleAuthRequest');
    expect(schemas).toHaveProperty('GoogleAuthResponse');
    expect(schemas).toHaveProperty('CompleteGoogleRegistrationRequest');
    expect(schemas).toHaveProperty('CompleteGoogleRegistrationResponse');
    expect(schemas).toHaveProperty('AuthProvidersResponse');

    // Verify reusable responses
    const responses = response.body.components.responses;
    expect(responses).toHaveProperty('BadRequestError');
    expect(responses).toHaveProperty('UnauthorizedError');
    expect(responses).toHaveProperty('ForbiddenError');
    expect(responses).toHaveProperty('NotFoundError');
    expect(responses).toHaveProperty('ActionSuccessResponse');
  });

  it('GET /api/docs/auth/ should serve Swagger UI HTML for Auth API', async () => {
    const response = await request(app).get('/api/docs/auth/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Lombok Explorer Auth API Documentation');
  });

  it('GET /docs/auth/ should also serve Swagger UI HTML (convenience alias)', async () => {
    const response = await request(app).get('/docs/auth/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('GET /api/docs/auth/json should serve parsed Auth OpenAPI specification JSON', async () => {
    const response = await request(app).get('/api/docs/auth/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('openapi', '3.0.3');
    expect(response.body.info).toHaveProperty('title', 'Lombok Explorer — Authentication & Identity API');
    expect(response.body).toHaveProperty('paths');
    expect(response.body).toHaveProperty('components');

    const paths = response.body.paths;
    expect(paths).toHaveProperty('/auth/register');
    expect(paths).toHaveProperty('/auth/login');
    expect(paths).toHaveProperty('/auth/google');
    expect(paths).toHaveProperty('/auth/google/register');
    expect(paths).toHaveProperty('/auth/google/link');
    expect(paths).toHaveProperty('/auth/providers');
    expect(paths).toHaveProperty('/auth/refresh');
    expect(paths).toHaveProperty('/auth/refresh-token');
    expect(paths).toHaveProperty('/auth/me');
    expect(paths).toHaveProperty('/auth/logout');
    expect(paths).toHaveProperty('/users/username/check');
    expect(paths).toHaveProperty('/admin/auth/login');
    expect(paths).toHaveProperty('/admin/auth/refresh');
    expect(paths).toHaveProperty('/admin/auth/me');
    expect(paths).toHaveProperty('/admin/auth/logout');

    const schemas = response.body.components.schemas;
    expect(schemas).toHaveProperty('RegisterRequest');
    expect(schemas).toHaveProperty('LoginRequest');
    expect(schemas).toHaveProperty('GoogleAuthRequest');
    expect(schemas).toHaveProperty('GoogleAuthResponse');
    expect(schemas).toHaveProperty('CompleteGoogleRegistrationRequest');
    expect(schemas).toHaveProperty('CompleteGoogleRegistrationResponse');
    expect(schemas).toHaveProperty('AuthProvidersResponse');
    expect(schemas).toHaveProperty('CheckUsernameResponse');
    expect(schemas).toHaveProperty('AdminLoginRequest');
    expect(schemas).toHaveProperty('AdminAuthResponse');
    expect(schemas).toHaveProperty('UserDto');
  });

  it('GET /api/docs/auth/yaml should serve raw Auth OpenAPI YAML specification', async () => {
    const response = await request(app).get('/api/docs/auth/yaml');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/yaml');
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('Lombok Explorer — Authentication & Identity API');
  });

  it('GET /api/docs/feed/ should serve Swagger UI HTML for Feed API', async () => {
    const response = await request(app).get('/api/docs/feed/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Lombok Explorer Feed & Community API Documentation');
  });

  it('GET /docs/feed/ should also serve Swagger UI HTML (convenience alias)', async () => {
    const response = await request(app).get('/docs/feed/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('GET /api/docs/feed/json should serve parsed Feed OpenAPI specification JSON', async () => {
    const response = await request(app).get('/api/docs/feed/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('openapi', '3.0.3');
    expect(response.body.info).toHaveProperty('title', 'Lombok Explorer — Feeds & Community API');
    expect(response.body).toHaveProperty('paths');
    expect(response.body).toHaveProperty('components');

    const paths = response.body.paths;
    expect(paths).toHaveProperty('/feeds');
    expect(paths).toHaveProperty('/feeds/destinations/search');
    expect(paths).toHaveProperty('/feeds/bookmarks');
    expect(paths).toHaveProperty('/feeds/users/{userId}');
    expect(paths).toHaveProperty('/feeds/posts');
    expect(paths).toHaveProperty('/feeds/posts/{id}');
    expect(paths).toHaveProperty('/feeds/posts/{id}/like');
    expect(paths).toHaveProperty('/feeds/posts/{id}/bookmark');
    expect(paths).toHaveProperty('/feeds/posts/{id}/share');
    expect(paths).toHaveProperty('/feeds/posts/{id}/report');
    expect(paths).toHaveProperty('/feeds/posts/{id}/comments');
    expect(paths).toHaveProperty('/feeds/comments/{commentId}');
    expect(paths).toHaveProperty('/admin/feeds/reports');
    expect(paths).toHaveProperty('/admin/feeds/reports/{id}');
    expect(paths).toHaveProperty('/admin/feeds/posts/{id}/status');

    const schemas = response.body.components.schemas;
    expect(schemas).toHaveProperty('FeedPostResponse');
    expect(schemas).toHaveProperty('FeedPostListResponse');
    expect(schemas).toHaveProperty('FeedPostDetailResponse');
    expect(schemas).toHaveProperty('CreatePostRequest');
    expect(schemas).toHaveProperty('UpdatePostRequest');
    expect(schemas).toHaveProperty('FeedCommentResponse');
    expect(schemas).toHaveProperty('CreateCommentRequest');
    expect(schemas).toHaveProperty('FeedReportResponse');
    expect(schemas).toHaveProperty('CreateReportRequest');
    expect(schemas).toHaveProperty('AdminReportListResponse');
  });

  it('GET /api/docs/feed/yaml should serve raw Feed OpenAPI YAML specification', async () => {
    const response = await request(app).get('/api/docs/feed/yaml');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/yaml');
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('Lombok Explorer — Feeds & Community API');
  });

  it('GET /api/docs/yaml should serve raw OpenAPI YAML specification', async () => {
    const response = await request(app).get('/api/docs/yaml');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/yaml');
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('title: Lombok Explorer API');
  });

  it('GET / root endpoint should return Swagger documentation URLs', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('docs', '/api/docs');
    expect(response.body.data).toHaveProperty('docsJson', '/api/docs/json');
    expect(response.body.data).toHaveProperty('docsYaml', '/api/docs/yaml');
  });
});

