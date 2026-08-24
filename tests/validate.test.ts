import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Application, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../src/common/middleware/validate.middleware';
import { errorHandlerMiddleware } from '../src/common/middleware/error.middleware';
import { ResponseUtil } from '../src/common/utils/api-response.util';

describe('Validation Middleware', () => {
  let app: Application;

  const testSchema = {
    body: z.object({
      name: z.string().min(3),
      email: z.string().email(),
      age: z.number().int().min(18).optional(),
    }),
    query: z.object({
      filter: z.enum(['active', 'archived']).optional(),
    }),
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.post('/test-validation', validate(testSchema), (req: Request, res: Response) => {
      ResponseUtil.sendSuccess(res, req.body, 'Validated successfully');
    });

    app.use(errorHandlerMiddleware);
  });

  it('should pass validation when body is valid', async () => {
    const response = await request(app).post('/test-validation').send({
      name: 'Rinjani Trekker',
      email: 'rinjani@lombok.com',
      age: 25,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Rinjani Trekker');
  });

  it('should return 400 with VALIDATION_ERROR and field details on invalid data', async () => {
    const response = await request(app).post('/test-validation').send({
      name: 'ab', // too short
      email: 'not-an-email',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(response.body.details).toBeInstanceOf(Array);
    expect(response.body.details.length).toBeGreaterThanOrEqual(2);
  });
});
