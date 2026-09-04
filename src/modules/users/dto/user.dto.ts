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
  avatarUrl: z.string().trim().url('Invalid avatar URL').nullable().optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number must not exceed 20 characters')
    .nullable()
    .optional(),
  travelStyle: z.nativeEnum(TravelStyle).nullable().optional(),
  preferredRegion: z.nativeEnum(LombokRegion).nullable().optional(),
});

export type CheckUsernameQueryDto = z.infer<typeof CheckUsernameQuerySchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
