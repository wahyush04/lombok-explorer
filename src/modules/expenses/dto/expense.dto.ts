import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';

export const ExpenseCategoryEnum = z.nativeEnum(ExpenseCategory);

export const CreateExpenseDtoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category: ExpenseCategoryEnum.default(ExpenseCategory.OTHER),
  currency: z.string().trim().default('IDR'),
  date: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  itineraryId: z.string().uuid().optional(),
});

export type CreateExpenseDto = z.infer<typeof CreateExpenseDtoSchema>;

export const UpdateExpenseDtoSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  amount: z.coerce.number().positive().optional(),
  category: ExpenseCategoryEnum.optional(),
  currency: z.string().trim().optional(),
  date: z.string().trim().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type UpdateExpenseDto = z.infer<typeof UpdateExpenseDtoSchema>;

export const ExpenseFilterQuerySchema = z.object({
  category: ExpenseCategoryEnum.optional(),
  itineraryId: z.string().uuid().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ExpenseFilterQuery = z.infer<typeof ExpenseFilterQuerySchema>;

export interface ExpenseDto {
  id: string;
  userId: string;
  itineraryId: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  totalAmount: number;
  percentage: number;
  count: number;
}

export interface ItineraryExpenseSummaryDto {
  totalExpense: number;
  budget: number;
  remainingBudget: number;
  perPerson: number;
  numberOfTravelers: number;
  breakdown: ExpenseCategoryBreakdown[];
  expenses: ExpenseDto[];
}
