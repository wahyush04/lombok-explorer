import { initializeApp, cert, getApps, getApp, App, ServiceAccount } from 'firebase-admin/app';
import {
  getMessaging,
  MulticastMessage,
  BatchResponse,
  SendResponse,
} from 'firebase-admin/messaging';
import { config } from '../../../config/config';
import { logger } from '../../../common/utils/logger';

export interface PushNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushNotificationResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export class FirebaseCloudMessagingService {
  private app: App | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initializes the Firebase Admin SDK using configured credentials.
   */
  private initialize(): void {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = getApp();
      this.isInitialized = true;
      return;
    }

    try {
      if (config.firebase.serviceAccountKey) {
        let serviceAccount: ServiceAccount;
        if (config.firebase.serviceAccountKey.startsWith('{')) {
          serviceAccount = JSON.parse(config.firebase.serviceAccountKey);
        } else {
          // File path
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          serviceAccount = require(config.firebase.serviceAccountKey);
        }
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
        this.isInitialized = true;
        logger.info('Firebase Admin SDK initialized successfully via service account key');
      } else if (
        config.firebase.projectId &&
        config.firebase.clientEmail &&
        config.firebase.privateKey
      ) {
        this.app = initializeApp({
          credential: cert({
            projectId: config.firebase.projectId,
            clientEmail: config.firebase.clientEmail,
            privateKey: config.firebase.privateKey,
          }),
        });
        this.isInitialized = true;
        logger.info('Firebase Admin SDK initialized successfully via environment variables');
      } else {
        logger.warn(
          'Firebase credentials not configured. FCM push notifications will run in mock/noop mode.',
        );
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Firebase Admin SDK');
      this.isInitialized = false;
    }
  }

  /**
   * Sends multicast push notifications to a list of device tokens.
   */
  public async sendMulticast(payload: PushNotificationPayload): Promise<PushNotificationResult> {
    const { tokens, title, body, data = {} } = payload;

    if (!tokens || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Ensure all data values are stringified
    const sanitizedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        sanitizedData[key] = String(value);
      }
    }

    if (!this.isInitialized || !this.app) {
      logger.debug(
        { tokensCount: tokens.length, title, body, data: sanitizedData },
        '[Mock FCM] Push notification sent (Firebase Admin unconfigured)',
      );
      return {
        successCount: tokens.length,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    try {
      const messaging = getMessaging(this.app);
      const message: MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: sanitizedData,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response: BatchResponse = await messaging.sendEachForMulticast(message);
      const invalidTokens: string[] = [];

      response.responses.forEach((res: SendResponse, idx: number) => {
        if (!res.success && res.error) {
          const errorCode = res.error.code;
          logger.warn(
            { token: tokens[idx], errorCode, errorMessage: res.error.message },
            'FCM message delivery failed for token',
          );

          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-argument'
          ) {
            if (tokens[idx]) {
              invalidTokens.push(tokens[idx]);
            }
          }
        }
      });

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error during FCM multicast push sending');
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
      };
    }
  }
}

export const firebaseCloudMessagingService = new FirebaseCloudMessagingService();
