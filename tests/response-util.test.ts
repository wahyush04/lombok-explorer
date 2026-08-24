import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Application, Request, Response } from 'express';
import { ResponseUtil } from '../src/common/utils/api-response.util';

describe('Common Foundation — Response Format (Phase 5)', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/test-success', (_req: Request, res: Response) => {
      ResponseUtil.sendSuccess(res, { id: 'dest_001', name: 'Pantai Tanjung Aan' }, 'Success fetching destination');
    });

    app.post('/test-created', (_req: Request, res: Response) => {
      ResponseUtil.sendCreated(res, { id: 'rev_123', rating: 5.0 }, 'Review created successfully');
    });

    app.get('/test-paginated', (_req: Request, res: Response) => {
      const items = [
        { id: 'dest_1', name: 'Pantai Tanjung Aan' },
        { id: 'dest_2', name: 'Bukit Merese' },
      ];
      const meta = { page: 1, limit: 10, total: 35, totalPages: 4 };

      ResponseUtil.sendPaginated(res, items, meta, 'Success fetching destinations');
    });

    app.delete('/test-action-success', (_req: Request, res: Response) => {
      ResponseUtil.sendActionSuccess(res, 'Destination removed from favorites');
    });
  });

  it('should format sendSuccess with data object correctly', async () => {
    const response = await request(app).get('/test-success');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Success fetching destination',
      data: {
        id: 'dest_001',
        name: 'Pantai Tanjung Aan',
      },
    });
  });

  it('should format sendCreated with 201 status and payload', async () => {
    const response = await request(app).post('/test-created');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      message: 'Review created successfully',
      data: {
        id: 'rev_123',
        rating: 5.0,
      },
    });
  });

  it('should format sendPaginated with data array and meta pagination', async () => {
    const response = await request(app).get('/test-paginated');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Success fetching destinations',
      data: [
        { id: 'dest_1', name: 'Pantai Tanjung Aan' },
        { id: 'dest_2', name: 'Bukit Merese' },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 35,
        totalPages: 4,
      },
    });
  });

  it('should format sendActionSuccess correctly', async () => {
    const response = await request(app).delete('/test-action-success');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Destination removed from favorites',
    });
  });
});
