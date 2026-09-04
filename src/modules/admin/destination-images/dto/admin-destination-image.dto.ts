import { z } from 'zod';
import { CloudinaryAssetInputSchema } from '../../uploads/dto/admin-uploads.dto';

export const CreateDestinationImageSchema = z.object({
  image: z.union([CloudinaryAssetInputSchema, z.string().trim()]).optional(),
  publicId: z.string().trim().optional(),
  secureUrl: z.string().trim().url('secureUrl must be a valid URL').optional(),
  imageUrl: z.string().trim().optional(),
  caption: z.string().trim().max(255).optional().nullable(),
  altText: z.string().trim().max(255).optional().nullable(),
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
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  format: z.string().trim().optional(),
});

export const UpdateDestinationImageSchema = z.object({
  image: z.union([CloudinaryAssetInputSchema, z.string().trim()]).optional(),
  publicId: z.string().trim().optional(),
  secureUrl: z.string().trim().url('secureUrl must be a valid URL').optional(),
  imageUrl: z.string().trim().optional(),
  caption: z.string().trim().max(255).optional().nullable(),
  altText: z.string().trim().max(255).optional().nullable(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isPrimary: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  format: z.string().trim().optional(),
});

export type CreateDestinationImageDto = z.infer<typeof CreateDestinationImageSchema>;
export type UpdateDestinationImageDto = z.infer<typeof UpdateDestinationImageSchema>;

export interface DestinationImageDto {
  id: string;
  destinationId: string;
  imageUrl: string;
  imagePublicId?: string | null;
  caption: string | null;
  altText: string | null;
  orderIndex: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}
