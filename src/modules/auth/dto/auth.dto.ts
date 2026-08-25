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

export const GoogleAuthDtoSchema = z.object({
  idToken: z
    .string({
      required_error: 'Google idToken is required',
    })
    .min(1, 'Google idToken cannot be empty'),
});

export const CompleteGoogleRegistrationDtoSchema = z
  .object({
    registrationToken: z
      .string({
        required_error: 'registrationToken is required',
      })
      .min(1, 'registrationToken cannot be empty'),
    username: z
      .string()
      .min(2, 'Username must be at least 2 characters')
      .max(100, 'Username must not exceed 100 characters')
      .optional(),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .optional(),
    password: z
      .string({
        required_error: 'Password is required',
      })
      .min(6, 'Password must be at least 6 characters')
      .max(100, 'Password must not exceed 100 characters'),
  })
  .refine((data) => data.username || data.name, {
    message: 'Username is required',
    path: ['username'],
  });

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;
export type LoginDto = z.infer<typeof LoginDtoSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;
export type GoogleAuthDto = z.infer<typeof GoogleAuthDtoSchema>;
export type CompleteGoogleRegistrationDto = z.infer<typeof CompleteGoogleRegistrationDtoSchema>;

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
  hasPassword?: boolean;
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

export type GoogleAuthResult =
  | {
      status: 'LOGIN_SUCCESS';
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: 'Bearer';
      user: SanitizedUser;
    }
  | {
      status: 'REGISTRATION_REQUIRED';
      registrationToken: string;
      profile: {
        name: string;
        email: string;
        avatarUrl?: string | null;
      };
    };

export interface CompleteGoogleRegistrationResult {
  status: 'REGISTRATION_SUCCESS';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: SanitizedUser;
}
