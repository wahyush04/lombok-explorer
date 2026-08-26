import { z } from 'zod';

export const BookmarkQueryDtoSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(20),
});

export type BookmarkQueryDto = z.infer<typeof BookmarkQueryDtoSchema>;
