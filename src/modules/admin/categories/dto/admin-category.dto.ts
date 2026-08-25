import { z } from 'zod';

export const AdminCategoryFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().optional(),
  sortBy: z
    .enum(['name', 'slug', 'createdAt', 'updatedAt', 'destinationsCount'])
    .optional()
    .default('name'),
  sort_by: z.enum(['name', 'slug', 'createdAt', 'updatedAt', 'destinationsCount']).optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  slug: z.string().trim().optional(),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  iconName: z.string().min(1, 'Icon name is required'),
  coverImageUrl: z.string().optional().default(''),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const DeleteCategoryQuerySchema = z.object({
  reassignTo: z.string().trim().optional(),
  force: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    }, z.boolean().optional())
    .optional(),
});

export type AdminCategoryFilterQuery = z.infer<typeof AdminCategoryFilterQuerySchema>;
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
export type DeleteCategoryQuery = z.infer<typeof DeleteCategoryQuerySchema>;

export interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  coverImageUrl: string;
  destinationsCount: number;
  createdAt: Date;
  updatedAt: Date;
}
