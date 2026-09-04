import { z } from 'zod';
import { LombokRegion, TravelStyle, UserRole, UserStatus } from '@prisma/client';
import { CloudinaryAssetInputSchema } from '../../uploads/dto/admin-uploads.dto';

export const AdminUserFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  email: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  startDate: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  createdFrom: z.string().trim().optional(),
  createdTo: z.string().trim().optional(),
  includeDeleted: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .default(false),
  sortBy: z
    .enum(['name', 'username', 'email', 'role', 'status', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sort_by: z
    .enum(['name', 'username', 'email', 'role', 'status', 'createdAt', 'updatedAt'])
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  phone: z.string().trim().nullable().optional(),
  avatar: CloudinaryAssetInputSchema.optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  travelStyle: z.nativeEnum(TravelStyle).nullable().optional(),
  preferredRegion: z.nativeEnum(LombokRegion).nullable().optional(),
  isEmailVerified: z.boolean().optional(),
});

export const UpdateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: "Status must be either 'ACTIVE', 'SUSPENDED', or 'INACTIVE'" }),
  }),
});

export const DeleteUserQuerySchema = z.object({
  hard: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .default(false),
});

export type AdminUserFilterQuery = z.infer<typeof AdminUserFilterQuerySchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>;
export type DeleteUserQueryDto = z.infer<typeof DeleteUserQuerySchema>;

export interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  avatarPublicId?: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  travelStyle: TravelStyle | null;
  preferredRegion: LombokRegion | null;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  stats?: {
    favoritesCount: number;
    reviewsCount: number;
    itinerariesCount: number;
    journalsCount: number;
  };
}
