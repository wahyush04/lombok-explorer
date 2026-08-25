import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';
import { paginationSchema } from '../../validation/admin-validation.schemas';

export const AdminReviewFilterQuerySchema = paginationSchema.extend({
  destinationId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
});

export type AdminReviewFilterQuery = z.infer<typeof AdminReviewFilterQuerySchema>;

export const ReviewModerationSchema = z.object({
  status: z.nativeEnum(ReviewStatus, {
    errorMap: () => ({
      message: "Status must be either 'APPROVED', 'PENDING', or 'REJECTED'",
    }),
  }),
  moderationNotes: z
    .string()
    .trim()
    .max(500, 'Moderation notes cannot exceed 500 characters')
    .optional(),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
});

export type ReviewModerationDto = z.infer<typeof ReviewModerationSchema>;

export interface AdminReviewUserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface AdminReviewDestinationDto {
  id: string;
  name: string;
  slug: string;
  locationName: string;
}

export interface AdminReviewDto {
  id: string;
  userId: string;
  user: AdminReviewUserDto | null;
  destinationId: string;
  destination: AdminReviewDestinationDto | null;
  rating: number;
  content: string;
  photos: string[];
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}
