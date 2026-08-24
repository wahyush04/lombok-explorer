import { Request, Response } from 'express';
import { adminDashboardService, AdminDashboardService } from './admin-dashboard.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { DashboardQuery } from './dto/admin-dashboard.dto';

export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService = adminDashboardService) {}

  public getDashboard = async (
    req: Request<unknown, unknown, unknown, DashboardQuery>,
    res: Response,
  ): Promise<void> => {
    const data = await this.service.getDashboardStatistics(req.query);
    ResponseUtil.sendSuccess(res, data, 'Dashboard statistics retrieved successfully');
  };
}

export const adminDashboardController = new AdminDashboardController();
