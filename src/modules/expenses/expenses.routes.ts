import { Router } from 'express';
import { expensesController } from './expenses.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import {
  CreateExpenseDtoSchema,
  ExpenseFilterQuerySchema,
  UpdateExpenseDtoSchema,
} from './dto/expense.dto';

const router = Router();

// GET /expenses (List user expense records)
router.get(
  '/',
  authenticate,
  validate({ query: ExpenseFilterQuerySchema }),
  expensesController.getExpenses,
);

// POST /expenses (Create expense)
router.post(
  '/',
  authenticate,
  validate({ body: CreateExpenseDtoSchema }),
  expensesController.createExpense,
);

// PUT /expenses/:id (Update expense)
router.put(
  '/:id',
  authenticate,
  validate({ body: UpdateExpenseDtoSchema }),
  expensesController.updateExpense,
);

// DELETE /expenses/:id (Delete expense)
router.delete('/:id', authenticate, expensesController.deleteExpense);

export const expenseRoutes: Router = router;
