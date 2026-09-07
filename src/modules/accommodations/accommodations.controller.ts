import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { accommodationsService, AccommodationsService } from './accommodations.service';
import { AccommodationFilterQuery } from './dto/accommodation.dto';

export class AccommodationsController {
  constructor(private readonly service: AccommodationsService = accommodationsService) {}

  public getAccommodations = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AccommodationFilterQuery;
    const { data, meta } = await this.service.getAccommodations(query, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendLocalizedPaginated(req, res, data, meta, 'ACCOMMODATIONS_RETRIEVED');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const data = await this.service.getFeaturedAccommodations(limit, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'ACCOMMODATIONS_RETRIEVED');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = await this.service.getAccommodationByIdOrSlug(id, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'DATA_RETRIEVED');
  });
}

export const accommodationsController = new AccommodationsController();
