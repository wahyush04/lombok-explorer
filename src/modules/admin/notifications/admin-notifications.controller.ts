import { Request, Response } from 'express';
import { adminNotificationsService, AdminNotificationsService } from './admin-notifications.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { AdminBroadcastNotificationDto } from './dto/admin-notification.dto';

export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService = adminNotificationsService) {}

  public sendBroadcast = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AdminBroadcastNotificationDto;
    const result = await this.service.sendBroadcast(
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, result, 'Broadcast notification dispatched successfully');
  };

  public getStats = async (_req: Request, res: Response): Promise<void> => {
    const stats = await this.service.getNotificationStats();
    ResponseUtil.sendSuccess(res, stats, 'Notification device statistics retrieved successfully');
  };
}

export const adminNotificationsController = new AdminNotificationsController();
