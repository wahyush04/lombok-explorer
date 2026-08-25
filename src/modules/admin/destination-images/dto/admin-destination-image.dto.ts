import { z } from 'zod';

export const CreateDestinationImageSchema = z.object({
  imageUrl: z.string().trim().optional(),
  caption: z.string().trim().max(255).optional(),
  altText: z.string().trim().max(255).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isPrimary: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional()
    .default(false),
});

export const UpdateDestinationImageSchema = z.object({
  imageUrl: z.string().trim().optional(),
  caption: z.string().trim().max(255).optional(),
  altText: z.string().trim().max(255).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isPrimary: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
});

export type CreateDestinationImageDto = z.infer<typeof CreateDestinationImageSchema>;
export type UpdateDestinationImageDto = z.infer<typeof UpdateDestinationImageSchema>;

export interface DestinationImageDto {
  id: string;
  destinationId: string;
  imageUrl: string;
  caption: string | null;
  altText: string | null;
  orderIndex: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}
