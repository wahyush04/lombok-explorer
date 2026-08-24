import { Expense, ExpenseCategory, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface ExpenseRepoFilter {
  userId: string;
  itineraryId?: string;
  category?: ExpenseCategory;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class ExpensesRepository {
  public async findMany(filters: ExpenseRepoFilter): Promise<{ items: Expense[]; total: number }> {
    const where: Prisma.ExpenseWhereInput = {
      userId: filters.userId,
    };

    if (filters.itineraryId) {
      where.itineraryId = filters.itineraryId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return { items, total };
  }

  public async findByItineraryId(itineraryId: string): Promise<Expense[]> {
    return prisma.expense.findMany({
      where: { itineraryId },
      orderBy: { date: 'desc' },
    });
  }

  public async findById(id: string): Promise<Expense | null> {
    return prisma.expense.findUnique({
      where: { id },
      include: { itinerary: true },
    });
  }

  public async create(data: {
    userId: string;
    itineraryId?: string | null;
    category: ExpenseCategory;
    title: string;
    amount: number;
    currency?: string;
    date?: Date;
    notes?: string | null;
  }): Promise<Expense> {
    return prisma.expense.create({
      data: {
        userId: data.userId,
        itineraryId: data.itineraryId || null,
        category: data.category,
        title: data.title,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency || 'IDR',
        date: data.date || new Date(),
        notes: data.notes || null,
      },
    });
  }

  public async update(
    id: string,
    data: {
      category?: ExpenseCategory;
      title?: string;
      amount?: number;
      currency?: string;
      date?: Date;
      notes?: string | null;
    },
  ): Promise<Expense> {
    return prisma.expense.update({
      where: { id },
      data: {
        ...(data.category && { category: data.category }),
        ...(data.title && { title: data.title }),
        ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.currency && { currency: data.currency }),
        ...(data.date && { date: data.date }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  public async delete(id: string): Promise<Expense> {
    return prisma.expense.delete({
      where: { id },
    });
  }
}

export const expensesRepository = new ExpensesRepository();
