import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { journalsService, JournalsService } from './journals.service';
import { CreateJournalDto, JournalQuery, UpdateJournalDto } from './dto/journal.dto';

export class JournalsController {
  constructor(private readonly service: JournalsService = journalsService) {}

  public getJournals = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as JournalQuery;
    const userId = req.user!.userId;

    const { data, meta } = await this.service.getJournals(query, userId);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching travel journals');
  });

  public getJournalById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const data = await this.service.getJournalById(id, userId, userRole);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching travel journal');
  });

  public createJournal = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as CreateJournalDto;

    const data = await this.service.createJournal(userId, dto);
    return ResponseUtil.sendCreated(res, data, 'Travel journal created successfully');
  });

  public updateJournal = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateJournalDto;

    const data = await this.service.updateJournal(id, userId, userRole, dto);
    return ResponseUtil.sendSuccess(res, data, 'Travel journal updated successfully');
  });

  public deleteJournal = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    await this.service.deleteJournal(id, userId, userRole);
    return ResponseUtil.sendActionSuccess(res, 'Travel journal deleted successfully');
  });
}

export const journalsController = new JournalsController();
