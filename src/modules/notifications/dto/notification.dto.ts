import { z } from 'zod';
import { NotificationType } from '@prisma/client';

export const NotificationQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .default(1)
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .default(20)
    .transform((val) => {
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 20 : Math.min(50, parsed);
    }),
  unreadOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
      return false;
    }),
});

export type NotificationQueryDto = z.infer<typeof NotificationQuerySchema>;

export interface NotificationActorDto {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor: NotificationActorDto;
  postId: string | null;
  commentId: string | null;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPaginationDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export interface NotificationListResult {
  items: NotificationItemDto[];
  pagination: NotificationPaginationDto;
}

export interface UnreadCountResult {
  unreadCount: number;
}
