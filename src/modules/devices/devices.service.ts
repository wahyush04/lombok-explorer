import { devicesRepository, DevicesRepository } from './devices.repository';
import { RegisterDeviceTokenDto, DeviceTokenResponse } from './dto/device.dto';
import { logger } from '../../common/utils/logger';

export class DevicesService {
  constructor(private readonly repository: DevicesRepository = devicesRepository) {}

  /**
   * Registers or refreshes an FCM device token for the authenticated user.
   */
  public async registerToken(
    userId: string,
    data: RegisterDeviceTokenDto,
  ): Promise<DeviceTokenResponse> {
    const device = await this.repository.upsertToken(userId, data);
    logger.info(
      { userId, platform: device.platform, tokenId: device.id },
      'FCM device token registered/refreshed',
    );

    return {
      id: device.id,
      userId: device.userId,
      token: device.token,
      platform: device.platform,
      deviceId: device.deviceId,
      isActive: device.isActive,
      lastUsedAt: device.lastUsedAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }

  /**
   * Deactivates an FCM device token when a user logs out or disables notifications on a device.
   */
  public async deactivateToken(userId: string, token: string): Promise<void> {
    await this.repository.deactivateToken(userId, token);
    logger.info({ userId }, 'FCM device token deactivated');
  }
}

export const devicesService = new DevicesService();
