import { prisma } from '../../../database/prisma';
import { firebaseCloudMessagingService } from '../../notifications/fcm/firebase.service';
import { devicesRepository } from '../../devices/devices.repository';
import {
  AdminBroadcastNotificationDto,
  AdminBroadcastResultDto,
} from './dto/admin-notification.dto';

export class AdminNotificationsService {
  public async sendBroadcast(
    dto: AdminBroadcastNotificationDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminBroadcastResultDto> {
    const { title, body, targetPlatform, targetRegion, imageUrl, deepLink, notificationType } = dto;

    // Filter active device tokens
    const whereClause: any = {
      isActive: true,
    };

    if (targetPlatform && targetPlatform !== 'ALL') {
      whereClause.platform = targetPlatform;
    }

    if (targetRegion) {
      whereClause.user = {
        preferredRegion: targetRegion,
      };
    }

    const deviceRecords = await prisma.deviceToken.findMany({
      where: whereClause,
      select: {
        token: true,
      },
    });

    const tokens = deviceRecords.map((d: { token: string }) => d.token);

    let sent = 0;
    let failed = 0;

    if (tokens.length > 0) {
      const dataPayload: Record<string, string> = {
        type: notificationType || 'ANNOUNCEMENT',
        ...(deepLink ? { deepLink } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };

      const fcmResult = await firebaseCloudMessagingService.sendMulticast({
        tokens,
        title,
        body,
        data: dataPayload,
      });

      sent = fcmResult.successCount;
      failed = fcmResult.failureCount;

      if (fcmResult.invalidTokens && fcmResult.invalidTokens.length > 0) {
        await devicesRepository.deactivateTokensByValues(fcmResult.invalidTokens);
      }
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: adminUserId || null,
        action: 'BROADCAST_NOTIFICATION',
        entity: 'Notification',
        entityId: 'broadcast-' + Date.now(),
        details: JSON.stringify({
          title,
          targetPlatform,
          targetRegion,
          totalTargeted: tokens.length,
          sent,
          failed,
        }),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      title,
      body,
      totalTargeted: tokens.length,
      totalSent: sent,
      totalFailed: failed,
      sentAt: new Date(),
    };
  }

  public async getNotificationStats() {
    const [totalTokens, androidTokens, iosTokens, webTokens, recentBroadcasts] = await Promise.all([
      prisma.deviceToken.count({ where: { isActive: true } }),
      prisma.deviceToken.count({ where: { isActive: true, platform: 'ANDROID' } }),
      prisma.deviceToken.count({ where: { isActive: true, platform: 'IOS' } }),
      prisma.deviceToken.count({ where: { isActive: true, platform: 'WEB' } }),
      prisma.auditLog.findMany({
        where: { action: 'BROADCAST_NOTIFICATION' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          details: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      devices: {
        totalActive: totalTokens,
        android: androidTokens,
        ios: iosTokens,
        web: webTokens,
      },
      recentBroadcasts: recentBroadcasts.map((log: any) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(log.details || '{}');
        } catch {}
        return {
          id: log.id,
          title: parsed.title || 'Broadcast Pengumuman',
          targetPlatform: parsed.targetPlatform || 'ALL',
          sentCount: parsed.sent || 0,
          failedCount: parsed.failed || 0,
          sentBy: log.user?.name || 'Admin',
          sentAt: log.createdAt,
        };
      }),
    };
  }
}

export const adminNotificationsService = new AdminNotificationsService();
