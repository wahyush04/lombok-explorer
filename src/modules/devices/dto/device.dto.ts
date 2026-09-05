import { z } from 'zod';

export const RegisterDeviceTokenSchema = z.object({
  token: z
    .string({
      required_error: 'FCM device token is required',
    })
    .min(1, 'Token cannot be empty')
    .trim(),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']).default('ANDROID'),
  deviceId: z.string().trim().optional(),
});

export const DeactivateDeviceTokenSchema = z.object({
  token: z
    .string({
      required_error: 'FCM device token is required',
    })
    .min(1, 'Token cannot be empty')
    .trim(),
});

export type RegisterDeviceTokenDto = z.infer<typeof RegisterDeviceTokenSchema>;
export type DeactivateDeviceTokenDto = z.infer<typeof DeactivateDeviceTokenSchema>;

export interface DeviceTokenResponse {
  id: string;
  userId: string;
  token: string;
  platform: string;
  deviceId: string | null;
  isActive: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}
