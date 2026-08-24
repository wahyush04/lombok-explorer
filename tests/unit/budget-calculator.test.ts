import { describe, it, expect } from 'vitest';
import { ExpenseCategory } from '../../src/common/constants';

interface ExpenseItem {
  amount: number;
  category: ExpenseCategory;
}

/**
 * Pure helper function implementing the core budget calculation logic
 * used in ExpensesService and ItinerariesService.
 */
function calculateFinancialSummary(
  budget: number,
  numberOfTravelers: number,
  expenses: ExpenseItem[],
) {
  const travelers = Math.max(1, numberOfTravelers);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const remainingBudget = budget - totalExpense;
  const perPersonCost = Math.round((totalExpense / travelers) * 100) / 100;

  // Category breakdown
  const categoryMap = new Map<ExpenseCategory, number>();
  for (const exp of expenses) {
    const current = categoryMap.get(exp.category) || 0;
    categoryMap.set(exp.category, current + exp.amount);
  }

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, subtotal]) => ({
    category,
    subtotal,
    percentage: totalExpense > 0 ? Math.round((subtotal / totalExpense) * 10000) / 100 : 0,
  }));

  return {
    totalBudget: budget,
    totalExpense,
    remainingBudget,
    isOverBudget: remainingBudget < 0,
    perPersonCost,
    numberOfTravelers: travelers,
    categoryBreakdown,
  };
}

describe('Unit Test: Budget & Expense Calculations (Phase 21)', () => {
  it('should correctly sum expenses and compute remaining budget when within budget', () => {
    const expenses: ExpenseItem[] = [
      { amount: 500000, category: ExpenseCategory.ACCOMMODATION },
      { amount: 250000, category: ExpenseCategory.FOOD },
      { amount: 150000, category: ExpenseCategory.TRANSPORT },
      { amount: 100000, category: ExpenseCategory.ACTIVITY },
    ];

    const result = calculateFinancialSummary(1500000, 2, expenses);

    expect(result.totalBudget).toBe(1500000);
    expect(result.totalExpense).toBe(1000000);
    expect(result.remainingBudget).toBe(500000);
    expect(result.isOverBudget).toBe(false);
    expect(result.perPersonCost).toBe(500000);
  });

  it('should correctly detect over-budget scenarios with negative remaining budget', () => {
    const expenses: ExpenseItem[] = [
      { amount: 1200000, category: ExpenseCategory.ACCOMMODATION },
      { amount: 500000, category: ExpenseCategory.FOOD },
    ];

    const result = calculateFinancialSummary(1000000, 1, expenses);

    expect(result.totalExpense).toBe(1700000);
    expect(result.remainingBudget).toBe(-700000);
    expect(result.isOverBudget).toBe(true);
  });

  it('should accurately calculate percentage contribution of each expense category', () => {
    const expenses: ExpenseItem[] = [
      { amount: 500000, category: ExpenseCategory.ACCOMMODATION }, // 50%
      { amount: 300000, category: ExpenseCategory.FOOD }, // 30%
      { amount: 200000, category: ExpenseCategory.TRANSPORT }, // 20%
    ];

    const result = calculateFinancialSummary(2000000, 2, expenses);

    const accom = result.categoryBreakdown.find(
      (c) => c.category === ExpenseCategory.ACCOMMODATION,
    );
    const food = result.categoryBreakdown.find((c) => c.category === ExpenseCategory.FOOD);
    const transport = result.categoryBreakdown.find(
      (c) => c.category === ExpenseCategory.TRANSPORT,
    );

    expect(accom?.percentage).toBe(50);
    expect(food?.percentage).toBe(30);
    expect(transport?.percentage).toBe(20);
  });

  it('should handle zero expenses gracefully without NaN or division by zero', () => {
    const result = calculateFinancialSummary(1000000, 3, []);

    expect(result.totalExpense).toBe(0);
    expect(result.remainingBudget).toBe(1000000);
    expect(result.perPersonCost).toBe(0);
    expect(result.isOverBudget).toBe(false);
    expect(result.categoryBreakdown).toHaveLength(0);
  });

  it('should handle single traveler and zero initial budget properly', () => {
    const expenses: ExpenseItem[] = [{ amount: 75000, category: ExpenseCategory.FOOD }];

    const result = calculateFinancialSummary(0, 0, expenses);

    expect(result.numberOfTravelers).toBe(1);
    expect(result.totalExpense).toBe(75000);
    expect(result.remainingBudget).toBe(-75000);
    expect(result.isOverBudget).toBe(true);
    expect(result.perPersonCost).toBe(75000);
  });
});
