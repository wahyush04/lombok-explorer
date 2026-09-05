import { NotificationType } from '@prisma/client';
import {
  notificationsRepository,
  NotificationsRepository,
  CreateNotificationParams,
} from './notifications.repository';
import {
  pushNotificationService,
  PushNotificationService,
} from './services/push-notification.service';
import {
  NotificationItemDto,
  NotificationListResult,
  NotificationQueryDto,
  UnreadCountResult,
} from './dto/notification.dto';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { logger } from '../../common/utils/logger';

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository = notificationsRepository,
    private readonly pushService: PushNotificationService = pushNotificationService,
  ) {}

  /**
   * Creates an in-app notification record and dispatches an asynchronous push notification to active devices.
   */
  public async createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationItemDto | null> {
    // Prevent self-notifications
    if (input.recipientId === input.actorId) {
      return null;
    }

    const createParams: CreateNotificationParams = {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId: input.postId || null,
      commentId: input.commentId || null,
      title: input.title,
      body: input.body,
      data: input.data ? JSON.stringify(input.data) : null,
    };

    const notification = await this.repository.create(createParams);

    // Trigger FCM Push asynchronously (Fire and Forget - Never rolls back or blocks caller)
    const pushData: Record<string, string> = {
      type: input.type,
      notificationId: notification.id,
      postId: input.postId || '',
      commentId: input.commentId || '',
      actorId: input.actorId,
    };

    this.pushService
      .sendPushToUser({
        recipientId: input.recipientId,
        title: input.title,
        body: input.body,
        data: pushData,
      })
      .catch((err) => {
        logger.error(
          { err, notificationId: notification.id, recipientId: input.recipientId },
          'Background FCM push notification dispatch failed',
        );
      });

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actor: {
        id: notification.actor.id,
        username: notification.actor.username,
        displayName: notification.actor.name,
        avatarUrl: notification.actor.avatarUrl,
      },
      postId: notification.postId,
      commentId: notification.commentId,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  public async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationListResult> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { totalItems, items } = await this.repository.findUserNotifications(userId, {
      page,
      limit,
      unreadOnly: query.unreadOnly,
    });

    const totalPages = Math.ceil(totalItems / limit) || 0;
    const hasNext = page < totalPages;

    const mappedItems: NotificationItemDto[] = items.map((notif) => ({
      id: notif.id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      actor: {
        id: notif.actor.id,
        username: notif.actor.username,
        displayName: notif.actor.name,
        avatarUrl: notif.actor.avatarUrl,
      },
      postId: notif.postId,
      commentId: notif.commentId,
      isRead: notif.isRead,
      readAt: notif.readAt ? notif.readAt.toISOString() : null,
      createdAt: notif.createdAt.toISOString(),
    }));

    return {
      items: mappedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext,
      },
    };
  }

  /**
   * Gets total count of unread notifications for the user.
   */
  public async getUnreadCount(userId: string): Promise<UnreadCountResult> {
    const count = await this.repository.countUnread(userId);
    return { unreadCount: count };
  }

  /**
   * Marks a single notification as read (Strictly recipient authorized).
   */
  public async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<{ id: string; isRead: boolean }> {
    const existing = await this.repository.findById(notificationId);

    if (!existing) {
      throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    if (existing.recipientId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to view or modify this notification',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.markAsRead(notificationId, userId);

    return {
      id: notificationId,
      isRead: true,
    };
  }

  /**
   * Marks all unread notifications of the user as read.
   */
  public async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.repository.markAllAsRead(userId);
    return { count: result.count };
  }
}

export const notificationsService = new NotificationsService();
