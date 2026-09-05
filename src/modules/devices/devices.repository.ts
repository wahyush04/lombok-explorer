import { prisma } from '../../database/prisma';
import { RegisterDeviceTokenDto } from './dto/device.dto';

export class DevicesRepository {
  /**
   * Upserts a device token for a user.
   * If the token already exists (e.g. from previous user on shared device or refreshed token),
   * updates the owner userId, platform, deviceId, activates it, and updates lastUsedAt.
   */
  public async upsertToken(userId: string, data: RegisterDeviceTokenDto) {
    return prisma.deviceToken.upsert({
      where: {
        token: data.token,
      },
      create: {
        userId,
        token: data.token,
        platform: data.platform || 'ANDROID',
        deviceId: data.deviceId || null,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        userId,
        platform: data.platform || 'ANDROID',
        ...(data.deviceId ? { deviceId: data.deviceId } : {}),
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Deactivates a specific token for a user.
   */
  public async deactivateToken(userId: string, token: string) {
    return prisma.deviceToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Bulk deactivates invalid/unregistered tokens reported by FCM.
   */
  public async deactivateTokensByValues(tokens: string[]) {
    if (tokens.length === 0) return { count: 0 };
    return prisma.deviceToken.updateMany({
      where: {
        token: { in: tokens },
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Finds all active device tokens for a given user ID.
   */
  public async findActiveTokensByUser(userId: string): Promise<string[]> {
    const devices = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    return devices.map((d: { token: string }) => d.token);
  }

  /**
   * Finds a device token record by its token string.
   */
  public async findByToken(token: string) {
    return prisma.deviceToken.findUnique({
      where: { token },
    });
  }
}

export const devicesRepository = new DevicesRepository();
