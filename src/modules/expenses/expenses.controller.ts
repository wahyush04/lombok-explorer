import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { expensesService, ExpensesService } from './expenses.service';
import { CreateExpenseDto, ExpenseFilterQuery, UpdateExpenseDto } from './dto/expense.dto';

export class ExpensesController {
  constructor(private readonly service: ExpensesService = expensesService) {}

  public getItineraryExpenses = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const data = await this.service.getItineraryExpenses(itineraryId, userId, userRole);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching itinerary expenses');
  });

  public addItineraryExpense = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as CreateExpenseDto;

    const data = await this.service.addItineraryExpense(itineraryId, userId, userRole, dto);
    return ResponseUtil.sendCreated(res, data, 'Expense added to itinerary successfully');
  });

  public getExpenses = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ExpenseFilterQuery;
    const userId = req.user!.userId;

    const { data, meta } = await this.service.getExpenses(query, userId);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching expenses');
  });

  public createExpense = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as CreateExpenseDto;

    const data = await this.service.createGeneralExpense(userId, dto);
    return ResponseUtil.sendCreated(res, data, 'Expense created successfully');
  });

  public updateExpense = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateExpenseDto;

    const data = await this.service.updateExpense(id, userId, userRole, dto);
    return ResponseUtil.sendSuccess(res, data, 'Expense updated successfully');
  });

  public deleteExpense = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    await this.service.deleteExpense(id, userId, userRole);
    return ResponseUtil.sendActionSuccess(res, 'Expense record deleted successfully');
  });
}

export const expensesController = new ExpensesController();
