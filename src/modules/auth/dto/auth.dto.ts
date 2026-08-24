import { z } from 'zod';
import { TravelStyle, LombokRegion, UserRole } from '@prisma/client';

export const RegisterDtoSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email address format'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must not exceed 100 characters'),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  preferredRegion: z.nativeEnum(LombokRegion).optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone number must not exceed 20 characters').optional(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
});

export const LoginDtoSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;
export type LoginDto = z.infer<typeof LoginDtoSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

export interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  role: UserRole;
  travelStyle: TravelStyle | null;
  preferredRegion: LombokRegion | null;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: SanitizedUser;
}
