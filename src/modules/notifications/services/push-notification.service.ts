import {
  firebaseCloudMessagingService,
  FirebaseCloudMessagingService,
} from '../fcm/firebase.service';
import { devicesRepository, DevicesRepository } from '../../devices/devices.repository';
import { logger } from '../../../common/utils/logger';

export interface SendPushParams {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class PushNotificationService {
  constructor(
    private readonly firebaseService: FirebaseCloudMessagingService = firebaseCloudMessagingService,
    private readonly devicesRepo: DevicesRepository = devicesRepository,
  ) {}

  /**
   * Dispatches push notifications to all active registered devices of a recipient.
   * Invalid or expired tokens returned by FCM are automatically deactivated.
   */
  public async sendPushToUser(params: SendPushParams): Promise<{ sent: number; failed: number }> {
    const { recipientId, title, body, data = {} } = params;

    try {
      const tokens = await this.devicesRepo.findActiveTokensByUser(recipientId);

      if (tokens.length === 0) {
        logger.debug({ recipientId }, 'No active device tokens found for push notification');
        return { sent: 0, failed: 0 };
      }

      const result = await this.firebaseService.sendMulticast({
        tokens,
        title,
        body,
        data,
      });

      if (result.invalidTokens && result.invalidTokens.length > 0) {
        logger.info(
          { count: result.invalidTokens.length, recipientId },
          'Deactivating invalid FCM device tokens reported by Firebase',
        );
        await this.devicesRepo.deactivateTokensByValues(result.invalidTokens);
      }

      logger.info(
        { recipientId, successCount: result.successCount, failureCount: result.failureCount },
        'Push notification batch delivery finished',
      );

      return {
        sent: result.successCount,
        failed: result.failureCount,
      };
    } catch (error) {
      logger.error({ err: error, recipientId }, 'Failed to dispatch push notification to user');
      return { sent: 0, failed: 0 };
    }
  }
}

export const pushNotificationService = new PushNotificationService();
