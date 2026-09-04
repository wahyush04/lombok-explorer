import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { restaurantsService, RestaurantsService } from './restaurants.service';
import { RestaurantFilterQuery } from './dto/restaurant.dto';

export class RestaurantsController {
  constructor(private readonly service: RestaurantsService = restaurantsService) {}

  public getRestaurants = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as RestaurantFilterQuery;
    const { data, meta } = await this.service.getRestaurants(query);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching restaurants');
  });

  public getFeatured = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 6;
    const data = await this.service.getFeaturedRestaurants(limit);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');

    return ResponseUtil.sendSuccess(res, data, 'Success fetching featured restaurants');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = await this.service.getRestaurantByIdOrSlug(id);

    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');

    return ResponseUtil.sendSuccess(res, data, 'Success fetching restaurant detail');
  });
}

export const restaurantsController = new RestaurantsController();
