import { z } from 'zod';

export const CreateCommentDtoSchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment content cannot be empty')
    .max(1000, 'Comment content cannot exceed 1000 characters'),
});

export const CommentQueryDtoSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(20),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateCommentDto = z.infer<typeof CreateCommentDtoSchema>;
export type CommentQueryDto = z.infer<typeof CommentQueryDtoSchema>;
