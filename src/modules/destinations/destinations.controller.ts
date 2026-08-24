import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { destinationsService, DestinationsService } from './destinations.service';
import {
  DestinationFilterQuery,
  NearbyDestinationQuery,
  SearchDestinationQuery,
} from './dto/destination.dto';

export class DestinationsController {
  constructor(private readonly service: DestinationsService = destinationsService) {}

  public getDestinations = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as DestinationFilterQuery;
    const { data, meta } = await this.service.getDestinations(query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching destinations');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const data = await this.service.getFeaturedDestinations(limit);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching featured destinations');
  });

  public getNearby = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as NearbyDestinationQuery;
    const data = await this.service.getNearbyDestinations(query);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching nearby destinations');
  });

  public search = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as SearchDestinationQuery;
    const { data, meta } = await this.service.searchDestinations(query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success searching destinations');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const destination = await this.service.getDestinationByIdOrSlug(id, userId);
    return ResponseUtil.sendSuccess(res, destination, 'Success fetching destination detail');
  });
}

export const destinationsController = new DestinationsController();
