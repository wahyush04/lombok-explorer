import { z } from 'zod';
import { LombokRegion, TravelStyle } from '@prisma/client';
import {
  basicUsernameFormatSchema,
  usernameSchema,
} from '../../../common/validators/username.validator';

export const CheckUsernameQuerySchema = z.object({
  username: basicUsernameFormatSchema,
});

export const UpdateProfileSchema = z.object({
  username: usernameSchema.optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  fullName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
  shortBio: z
    .string()
    .trim()
    .max(500, 'Bio must not exceed 500 characters')
    .nullable()
    .optional()
    .or(z.literal('')),
  bio: z
    .string()
    .trim()
    .max(500, 'Bio must not exceed 500 characters')
    .nullable()
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().trim().url('Invalid avatar URL').nullable().optional().or(z.literal('')),
  avatarPublicId: z.string().trim().nullable().optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number must not exceed 20 characters')
    .nullable()
    .optional(),
  phoneNumber: z
    .string()
    .trim()
    .max(20, 'Phone number must not exceed 20 characters')
    .nullable()
    .optional(),
  travelStyle: z.nativeEnum(TravelStyle).nullable().optional(),
  preferredRegion: z.nativeEnum(LombokRegion).nullable().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(6, 'Password must be at least 6 characters')
      .max(100, 'Password must not exceed 100 characters'),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword && data.newPassword !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: 'Confirm password does not match new password',
      path: ['confirmPassword'],
    },
  );

export type CheckUsernameQueryDto = z.infer<typeof CheckUsernameQuerySchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
