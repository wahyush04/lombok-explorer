import { z } from 'zod';
import { ChecklistCategory } from '@prisma/client';

export const ChecklistCategoryEnum = z.nativeEnum(ChecklistCategory);

export const ChecklistItemInputSchema = z.object({
  id: z.string().optional(),
  itemText: z.string().trim().min(1, 'Item text is required').max(200),
  isChecked: z.boolean().optional().default(false),
  orderIndex: z.coerce.number().int().min(0).optional().default(0),
});

export type ChecklistItemInput = z.infer<typeof ChecklistItemInputSchema>;

export const CreateChecklistDtoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  category: ChecklistCategoryEnum.default(ChecklistCategory.GENERAL),
  items: z.array(ChecklistItemInputSchema).optional().default([]),
});

export type CreateChecklistDto = z.infer<typeof CreateChecklistDtoSchema>;

export const UpdateChecklistDtoSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  category: ChecklistCategoryEnum.optional(),
  items: z.array(ChecklistItemInputSchema).optional(),
});

export type UpdateChecklistDto = z.infer<typeof UpdateChecklistDtoSchema>;

export const ChecklistQuerySchema = z.object({
  category: ChecklistCategoryEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ChecklistQuery = z.infer<typeof ChecklistQuerySchema>;

export interface ChecklistItemDto {
  id: string;
  checklistId: string;
  itemText: string;
  isChecked: boolean;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistDto {
  id: string;
  userId: string;
  title: string;
  category: ChecklistCategory;
  items: ChecklistItemDto[];
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}
