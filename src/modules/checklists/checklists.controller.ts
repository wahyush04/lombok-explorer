import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { checklistsService, ChecklistsService } from './checklists.service';
import { ChecklistQuery, CreateChecklistDto, UpdateChecklistDto } from './dto/checklist.dto';

export class ChecklistsController {
  constructor(private readonly service: ChecklistsService = checklistsService) {}

  public getChecklists = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ChecklistQuery;
    const userId = req.user!.userId;

    const { data, meta } = await this.service.getChecklists(query, userId);
    return ResponseUtil.sendPaginated(
      res,
      data,
      meta,
      'Success fetching travel packing checklists',
    );
  });

  public getChecklistById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const data = await this.service.getChecklistById(id, userId, userRole);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching packing checklist');
  });

  public createChecklist = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as CreateChecklistDto;

    const data = await this.service.createChecklist(userId, dto);
    return ResponseUtil.sendCreated(res, data, 'Packing checklist created successfully');
  });

  public updateChecklist = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateChecklistDto;

    const data = await this.service.updateChecklist(id, userId, userRole, dto);
    return ResponseUtil.sendSuccess(res, data, 'Packing checklist updated successfully');
  });

  public deleteChecklist = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    await this.service.deleteChecklist(id, userId, userRole);
    return ResponseUtil.sendActionSuccess(res, 'Packing checklist deleted successfully');
  });
}

export const checklistsController = new ChecklistsController();
