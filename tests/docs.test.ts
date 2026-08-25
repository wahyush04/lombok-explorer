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
    expect(paths).toHaveProperty('/auth/refresh-token');
    expect(paths).toHaveProperty('/auth/me');
    expect(paths).toHaveProperty('/auth/logout');
    expect(paths).toHaveProperty('/users/profile');
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

    // Verify reusable responses
    const responses = response.body.components.responses;
    expect(responses).toHaveProperty('BadRequestError');
    expect(responses).toHaveProperty('UnauthorizedError');
    expect(responses).toHaveProperty('ForbiddenError');
    expect(responses).toHaveProperty('NotFoundError');
    expect(responses).toHaveProperty('ActionSuccessResponse');
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
