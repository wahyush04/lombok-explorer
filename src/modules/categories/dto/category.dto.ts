import { z } from 'zod';

export const CategoryParamSchema = z.object({
  id: z.string().min(1, 'Category ID or slug is required'),
});

export const CategoryDestinationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort_by: z
    .enum(['popular', 'rating', 'name', 'price_asc', 'price_desc', 'newest'])
    .default('popular'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CategoryDestinationsQuery = z.infer<typeof CategoryDestinationsQuerySchema>;

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  coverImageUrl: string;
  destinationCount: number;
  createdAt: Date;
  updatedAt: Date;
}
