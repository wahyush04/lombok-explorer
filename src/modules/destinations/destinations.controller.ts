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
    const userId = req.user?.userId;
    const { data, meta } = await this.service.getDestinations(query, userId, req.locale);

    res.setHeader('Vary', 'Authorization, Accept-Encoding, Accept-Language');
    if (userId) {
      res.setHeader('Cache-Control', 'private, no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    return ResponseUtil.sendLocalizedPaginated(req, res, data, meta, 'DESTINATIONS_RETRIEVED');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const userId = req.user?.userId;
    const data = await this.service.getFeaturedDestinations(limit, userId, req.locale);

    res.setHeader('Vary', 'Authorization, Accept-Encoding, Accept-Language');
    if (userId) {
      res.setHeader('Cache-Control', 'private, no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    }

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'FEATURED_DESTINATIONS_RETRIEVED');
  });

  public getNearby = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as NearbyDestinationQuery;
    const userId = req.user?.userId;
    const data = await this.service.getNearbyDestinations(query, userId, req.locale);

    res.setHeader('Vary', 'Authorization, Accept-Encoding, Accept-Language');
    if (userId) {
      res.setHeader('Cache-Control', 'private, no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'NEARBY_DESTINATIONS_RETRIEVED');
  });

  public search = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as SearchDestinationQuery;
    const userId = req.user?.userId;
    const { data, meta } = await this.service.searchDestinations(query, userId, req.locale);

    res.setHeader('Vary', 'Authorization, Accept-Encoding, Accept-Language');
    if (userId) {
      res.setHeader('Cache-Control', 'private, no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    return ResponseUtil.sendLocalizedPaginated(req, res, data, meta, 'DESTINATIONS_RETRIEVED');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const destination = await this.service.getDestinationByIdOrSlug(id, userId, req.locale);

    res.setHeader('Vary', 'Authorization, Accept-Encoding, Accept-Language');
    if (userId) {
      res.setHeader('Cache-Control', 'private, no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    }

    return ResponseUtil.sendLocalizedSuccess(req, res, destination, 'DESTINATION_RETRIEVED');
  });
}

export const destinationsController = new DestinationsController();
