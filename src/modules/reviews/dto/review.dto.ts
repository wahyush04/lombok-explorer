import { z } from 'zod';

export const CreateReviewDtoSchema = z.object({
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  content: z
    .string()
    .trim()
    .min(3, 'Review content must be at least 3 characters')
    .max(2000, 'Review content cannot exceed 2000 characters'),
  photos: z.array(z.string().url('Each photo must be a valid URL')).optional(),
});

export const UpdateReviewDtoSchema = z
  .object({
    rating: z.coerce
      .number()
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5')
      .optional(),
    content: z
      .string()
      .trim()
      .min(3, 'Review content must be at least 3 characters')
      .max(2000, 'Review content cannot exceed 2000 characters')
      .optional(),
    photos: z.array(z.string().url('Each photo must be a valid URL')).optional(),
  })
  .refine(
    (data) => data.rating !== undefined || data.content !== undefined || data.photos !== undefined,
    { message: 'At least one field (rating, content, photos) must be provided for update' },
  );

export const ReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort_by: z.enum(['newest', 'highest', 'lowest', 'oldest']).default('newest'),
});

export const DestinationReviewParamSchema = z.object({
  id: z.string().min(1, 'Destination ID or slug is required'),
});

export const ReviewParamSchema = z.object({
  id: z.string().min(1, 'Review ID is required'),
});

export type CreateReviewDto = z.infer<typeof CreateReviewDtoSchema>;
export type UpdateReviewDto = z.infer<typeof UpdateReviewDtoSchema>;
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;

export interface ReviewAuthorDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ReviewDto {
  id: string;
  userId: string;
  destinationId: string;
  rating: number;
  content: string;
  photos: string[];
  user: ReviewAuthorDto;
  createdAt: Date;
  updatedAt: Date;
}
