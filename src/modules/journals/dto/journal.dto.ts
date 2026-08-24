import { z } from 'zod';

export const CreateJournalDtoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().trim().min(1, 'Content is required'),
  locationName: z.string().trim().max(200).optional().nullable(),
  date: z.string().trim().optional(),
  photos: z.array(z.string().url()).optional().default([]),
  isPublic: z.boolean().optional().default(false),
});

export type CreateJournalDto = z.infer<typeof CreateJournalDtoSchema>;

export const UpdateJournalDtoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).optional(),
  locationName: z.string().trim().max(200).nullable().optional(),
  date: z.string().trim().optional(),
  photos: z.array(z.string().url()).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateJournalDto = z.infer<typeof UpdateJournalDtoSchema>;

export const JournalQuerySchema = z.object({
  search: z.string().trim().optional(),
  isPublic: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type JournalQuery = z.infer<typeof JournalQuerySchema>;

export interface TravelJournalDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  locationName: string | null;
  date: string;
  photos: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
