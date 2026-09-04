import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { accommodationsService, AccommodationsService } from './accommodations.service';
import { AccommodationFilterQuery } from './dto/accommodation.dto';

export class AccommodationsController {
  constructor(private readonly service: AccommodationsService = accommodationsService) {}

  public getAccommodations = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AccommodationFilterQuery;
    const { data, meta } = await this.service.getAccommodations(query);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching accommodations');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const data = await this.service.getFeaturedAccommodations(limit);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');

    return ResponseUtil.sendSuccess(res, data, 'Success fetching featured accommodations');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = await this.service.getAccommodationByIdOrSlug(id);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendSuccess(res, data, 'Success fetching accommodation detail');
  });
}

export const accommodationsController = new AccommodationsController();
