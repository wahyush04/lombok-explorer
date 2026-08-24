import { Expense, ExpenseCategory } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { prisma } from '../../database/prisma';
import {
  CreateExpenseDto,
  ExpenseCategoryBreakdown,
  ExpenseDto,
  ExpenseFilterQuery,
  ItineraryExpenseSummaryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { expensesRepository, ExpensesRepository } from './expenses.repository';
import { PaginationMeta } from '../../common/types';

export class ExpensesService {
  constructor(private readonly repository: ExpensesRepository = expensesRepository) {}

  public mapToDto(expense: Expense): ExpenseDto {
    return {
      id: expense.id,
      userId: expense.userId,
      itineraryId: expense.itineraryId,
      category: expense.category,
      title: expense.title,
      amount: Number(expense.amount) || 0,
      currency: expense.currency,
      date: expense.date ? (new Date(expense.date).toISOString().split('T')[0] ?? '') : '',
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }

  public async getItineraryExpenses(
    itineraryId: string,
    userId: string,
    userRole: string,
  ): Promise<ItineraryExpenseSummaryDto> {
    // 1. Fetch Itinerary & verify authorization
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId, deletedAt: null },
    });

    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${itineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN' && !itinerary.isPublic) {
      throw new ForbiddenError(
        'You do not have permission to view expenses for this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    // 2. Fetch all expenses for this itinerary
    const expenses = await this.repository.findByItineraryId(itineraryId);
    const mappedExpenses = expenses.map((e) => this.mapToDto(e));

    // 3. Compute Totals & Balances
    const totalExpense = mappedExpenses.reduce((sum, item) => sum + item.amount, 0);
    const budget = Number(itinerary.totalEstimatedBudget) || 0;
    const remainingBudget = budget - totalExpense;
    const numberOfTravelers = 1; // Default traveler base
    const perPerson = Math.round(totalExpense / numberOfTravelers);

    // 4. Compute Category Breakdown
    const categoryMap = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const exp of mappedExpenses) {
      const current = categoryMap.get(exp.category) || { total: 0, count: 0 };
      categoryMap.set(exp.category, {
        total: current.total + exp.amount,
        count: current.count + 1,
      });
    }

    const breakdown: ExpenseCategoryBreakdown[] = Array.from(categoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        totalAmount: data.total,
        percentage: totalExpense > 0 ? Math.round((data.total / totalExpense) * 1000) / 10 : 0,
        count: data.count,
      }),
    );

    return {
      totalExpense,
      budget,
      remainingBudget,
      perPerson,
      numberOfTravelers,
      breakdown,
      expenses: mappedExpenses,
    };
  }

  public async addItineraryExpense(
    itineraryId: string,
    userId: string,
    userRole: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId, deletedAt: null },
    });

    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${itineraryId}' not found`, 'ITINERARY_NOT_FOUND');
    }

    if (itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to add expenses to this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    const created = await this.repository.create({
      userId,
      itineraryId,
      category: dto.category,
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date ? new Date(dto.date) : new Date(),
      notes: dto.notes,
    });

    return this.mapToDto(created);
  }

  public async createGeneralExpense(userId: string, dto: CreateExpenseDto): Promise<ExpenseDto> {
    const created = await this.repository.create({
      userId,
      itineraryId: dto.itineraryId || null,
      category: dto.category,
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date ? new Date(dto.date) : new Date(),
      notes: dto.notes,
    });

    return this.mapToDto(created);
  }

  public async getExpenses(
    query: ExpenseFilterQuery,
    userId: string,
  ): Promise<{ data: ExpenseDto[]; meta: PaginationMeta }> {
    const { items, total } = await this.repository.findMany({
      userId,
      itineraryId: query.itineraryId,
      category: query.category,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page,
      limit: query.limit,
    });

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: items.map((i) => this.mapToDto(i)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  public async updateExpense(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Expense '${id}' not found`, 'EXPENSE_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this expense record',
        'FORBIDDEN_RESOURCE',
      );
    }

    const updated = await this.repository.update(id, {
      category: dto.category,
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      date: dto.date ? new Date(dto.date) : undefined,
      notes: dto.notes,
    });

    return this.mapToDto(updated);
  }

  public async deleteExpense(id: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Expense '${id}' not found`, 'EXPENSE_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this expense record',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(id);
  }
}

export const expensesService = new ExpensesService();
