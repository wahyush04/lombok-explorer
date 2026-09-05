import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseCloudMessagingService } from '../src/modules/notifications/fcm/firebase.service';
import { PushNotificationService } from '../src/modules/notifications/services/push-notification.service';
import { DevicesRepository } from '../src/modules/devices/devices.repository';

describe('FCM and Push Notification Services', () => {
  let fcmService: FirebaseCloudMessagingService;
  let mockDevicesRepo: DevicesRepository;
  let pushService: PushNotificationService;

  beforeEach(() => {
    fcmService = new FirebaseCloudMessagingService();
    mockDevicesRepo = {
      findActiveTokensByUser: vi.fn(),
      deactivateTokensByValues: vi.fn(),
      upsertToken: vi.fn(),
      deactivateToken: vi.fn(),
      findByToken: vi.fn(),
    } as unknown as DevicesRepository;

    pushService = new PushNotificationService(fcmService, mockDevicesRepo);
  });

  describe('FirebaseCloudMessagingService', () => {
    it('should return empty result when tokens array is empty', async () => {
      const result = await fcmService.sendMulticast({
        tokens: [],
        title: 'Test Title',
        body: 'Test Body',
      });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.invalidTokens).toEqual([]);
    });

    it('should handle unconfigured Firebase Admin gracefully in mock mode', async () => {
      // Force unconfigured / mock mode on this instance
      (fcmService as any).isInitialized = false;

      const result = await fcmService.sendMulticast({
        tokens: ['token_1', 'token_2'],
        title: 'Hello Lombok',
        body: 'Selamat datang',
        data: {
          postId: 'post_123',
          count: '5',
        },
      });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.invalidTokens).toEqual([]);
    });

    it('should detect invalid tokens when calling live Firebase with invalid token strings', async () => {
      const result = await fcmService.sendMulticast({
        tokens: ['fake_dummy_token_123'],
        title: 'Test Live Token',
        body: 'Test Body',
      });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.invalidTokens).toContain('fake_dummy_token_123');
    });
  });

  describe('PushNotificationService', () => {
    it('should return sent: 0 when user has no active tokens', async () => {
      vi.mocked(mockDevicesRepo.findActiveTokensByUser).mockResolvedValueOnce([]);

      const result = await pushService.sendPushToUser({
        recipientId: 'user_123',
        title: 'Notification',
        body: 'Test Message',
      });

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockDevicesRepo.findActiveTokensByUser).toHaveBeenCalledWith('user_123');
    });

    it('should dispatch to FCM and automatically deactivate invalid tokens', async () => {
      vi.mocked(mockDevicesRepo.findActiveTokensByUser).mockResolvedValueOnce([
        'valid_token_1',
        'stale_token_2',
      ]);

      vi.spyOn(fcmService, 'sendMulticast').mockResolvedValueOnce({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ['stale_token_2'],
      });

      const result = await pushService.sendPushToUser({
        recipientId: 'user_123',
        title: 'New Like',
        body: 'Someone liked your post',
        data: { postId: 'post_123' },
      });

      expect(result).toEqual({ sent: 1, failed: 1 });
      expect(mockDevicesRepo.deactivateTokensByValues).toHaveBeenCalledWith(['stale_token_2']);
    });
  });
});
