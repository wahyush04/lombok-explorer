import { Request, Response } from 'express';
import {
  adminAccommodationsService,
  AdminAccommodationsService,
} from './admin-accommodations.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminAccommodationFilterQuery,
  CreateAccommodationDto,
  DeleteAccommodationQueryDto,
  UpdateAccommodationDto,
} from './dto/admin-accommodation.dto';

export class AdminAccommodationsController {
  constructor(private readonly service: AdminAccommodationsService = adminAccommodationsService) {}

  public getAccommodations = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminAccommodationFilterQuery;
    const { data, meta } = await this.service.getAccommodations(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Accommodations retrieved successfully');
  };

  public getAccommodationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getAccommodationById(id as string);
    ResponseUtil.sendSuccess(res, data, 'Accommodation details retrieved successfully');
  };

  public createAccommodation = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateAccommodationDto;
    const data = await this.service.createAccommodation(
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Accommodation created successfully');
  };

  public updateAccommodation = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateAccommodationDto;
    const data = await this.service.updateAccommodation(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Accommodation updated successfully');
  };

  public deleteAccommodation = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const query = req.query as unknown as DeleteAccommodationQueryDto;
    await this.service.deleteAccommodation(
      id as string,
      query.hard,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Accommodation deleted successfully');
  };
}

export const adminAccommodationsController = new AdminAccommodationsController();
