import { Request, Response } from 'express';
import { adminDestinationsService, AdminDestinationsService } from './admin-destinations.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminDestinationFilterQuery,
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/admin-destination.dto';

export class AdminDestinationsController {
  constructor(private readonly service: AdminDestinationsService = adminDestinationsService) {}

  public getDestinations = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminDestinationFilterQuery;
    const { data, meta } = await this.service.getDestinations(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Destinations retrieved successfully');
  };

  public getDestinationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getDestinationByIdOrSlug(id as string);
    ResponseUtil.sendSuccess(res, data, 'Destination details retrieved successfully');
  };

  public createDestination = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateDestinationDto;
    const data = await this.service.createDestination(
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Destination created successfully');
  };

  public updateDestination = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateDestinationDto;
    const data = await this.service.updateDestination(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Destination updated successfully');
  };

  public updateDestinationStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const data = await this.service.updateDestinationStatus(
      id as string,
      status,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Destination status updated successfully');
  };

  public deleteDestination = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';
    await this.service.deleteDestination(
      id as string,
      hardDelete,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Destination deleted successfully');
  };
}

export const adminDestinationsController = new AdminDestinationsController();
