import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { restaurantsService, RestaurantsService } from './restaurants.service';
import { RestaurantFilterQuery } from './dto/restaurant.dto';

export class RestaurantsController {
  constructor(private readonly service: RestaurantsService = restaurantsService) {}

  public getRestaurants = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as RestaurantFilterQuery;
    const { data, meta } = await this.service.getRestaurants(query, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendLocalizedPaginated(req, res, data, meta, 'RESTAURANTS_RETRIEVED');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const data = await this.service.getFeaturedRestaurants(limit, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'RESTAURANTS_RETRIEVED');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = await this.service.getRestaurantByIdOrSlug(id, req.locale);

    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'DATA_RETRIEVED');
  });
}

export const restaurantsController = new RestaurantsController();
