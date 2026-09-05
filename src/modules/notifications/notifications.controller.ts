import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { HttpStatus } from '../../common/constants';
import { notificationsService, NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification.dto';

export class NotificationsController {
  constructor(private readonly service: NotificationsService = notificationsService) {}

  public getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const query = req.query as unknown as NotificationQueryDto;
    const result = await this.service.getNotifications(userId, query);
    return ResponseUtil.sendSuccess(
      res,
      result,
      'Notifications retrieved successfully',
      HttpStatus.OK,
    );
  });

  public getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.service.getUnreadCount(userId);
    return ResponseUtil.sendSuccess(
      res,
      result,
      'Unread notification count retrieved successfully',
      HttpStatus.OK,
    );
  });

  public markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const notificationId = String(req.params.id);
    const result = await this.service.markAsRead(userId, notificationId);
    return ResponseUtil.sendSuccess(res, result, 'Notification marked as read', HttpStatus.OK);
  });

  public markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.service.markAllAsRead(userId);
    return ResponseUtil.sendSuccess(
      res,
      result,
      'All notifications marked as read successfully',
      HttpStatus.OK,
    );
  });
}

export const notificationsController = new NotificationsController();
