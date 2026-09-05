import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface CreateNotificationParams {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  title: string;
  body: string;
  data?: string | null;
}

export class NotificationsRepository {
  private readonly defaultActorSelect = {
    id: true,
    name: true,
    username: true,
    avatarUrl: true,
  };

  /**
   * Creates a new notification record in the database.
   */
  public async create(params: CreateNotificationParams) {
    return prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        type: params.type,
        postId: params.postId || null,
        commentId: params.commentId || null,
        title: params.title,
        body: params.body,
        data: params.data || null,
      },
      include: {
        actor: {
          select: this.defaultActorSelect,
        },
      },
    });
  }

  /**
   * Finds paginated notifications for a recipient.
   */
  public async findUserNotifications(
    recipientId: string,
    params: { page: number; limit: number; unreadOnly?: boolean },
  ) {
    const { page, limit, unreadOnly } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [totalItems, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: this.defaultActorSelect,
          },
        },
      }),
    ]);

    return { totalItems, items };
  }

  /**
   * Counts unread notifications for a user.
   */
  public async countUnread(recipientId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        recipientId,
        isRead: false,
      },
    });
  }

  /**
   * Finds a single notification by ID.
   */
  public async findById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
      include: {
        actor: {
          select: this.defaultActorSelect,
        },
      },
    });
  }

  /**
   * Marks a specific notification as read if owned by the recipient.
   */
  public async markAsRead(id: string, recipientId: string) {
    return prisma.notification.updateMany({
      where: {
        id,
        recipientId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all unread notifications for a recipient as read.
   */
  public async markAllAsRead(recipientId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
