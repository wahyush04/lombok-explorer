import { Request, Response } from 'express';
import { adminTripSessionsService, AdminTripSessionsService } from './admin-trip-sessions.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { AdminTripSessionFilterQuery } from './dto/admin-trip-session.dto';

export class AdminTripSessionsController {
  constructor(private readonly service: AdminTripSessionsService = adminTripSessionsService) {}

  public getTripSessions = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminTripSessionFilterQuery;
    const { data, meta } = await this.service.getTripSessions(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Trip sessions retrieved successfully');
  };

  public getTripSessionById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getTripSessionById(id as string);
    ResponseUtil.sendSuccess(res, data, 'Trip session details retrieved successfully');
  };

  public getLiveMapPoints = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getLiveMapPoints();
    ResponseUtil.sendSuccess(res, data, 'Live map tourist points retrieved successfully');
  };
}

export const adminTripSessionsController = new AdminTripSessionsController();
