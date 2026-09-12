import { z } from 'zod';
import { LombokRegion } from '@prisma/client';

export const AdminBroadcastNotificationSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  body: z.string().trim().min(5, 'Message body must be at least 5 characters'),
  targetPlatform: z.enum(['ALL', 'ANDROID', 'IOS', 'WEB']).default('ALL'),
  targetRegion: z.nativeEnum(LombokRegion).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  deepLink: z.string().trim().optional().nullable(),
  notificationType: z.string().trim().default('ANNOUNCEMENT'),
});

export type AdminBroadcastNotificationDto = z.infer<typeof AdminBroadcastNotificationSchema>;

export interface AdminBroadcastResultDto {
  title: string;
  body: string;
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  sentAt: Date;
}
