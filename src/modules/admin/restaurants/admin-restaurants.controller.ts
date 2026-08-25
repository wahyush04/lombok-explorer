import { Request, Response } from 'express';
import { adminRestaurantsService, AdminRestaurantsService } from './admin-restaurants.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminRestaurantFilterQuery,
  CreateRestaurantDto,
  DeleteRestaurantQueryDto,
  UpdateRestaurantDto,
} from './dto/admin-restaurant.dto';

export class AdminRestaurantsController {
  constructor(private readonly service: AdminRestaurantsService = adminRestaurantsService) {}

  public getRestaurants = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminRestaurantFilterQuery;
    const { data, meta } = await this.service.getRestaurants(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Restaurants retrieved successfully');
  };

  public getRestaurantById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getRestaurantById(id as string);
    ResponseUtil.sendSuccess(res, data, 'Restaurant details retrieved successfully');
  };

  public createRestaurant = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateRestaurantDto;
    const data = await this.service.createRestaurant(
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Restaurant created successfully');
  };

  public updateRestaurant = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateRestaurantDto;
    const data = await this.service.updateRestaurant(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Restaurant updated successfully');
  };

  public deleteRestaurant = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const query = req.query as unknown as DeleteRestaurantQueryDto;
    await this.service.deleteRestaurant(
      id as string,
      query.hard,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Restaurant deleted successfully');
  };
}

export const adminRestaurantsController = new AdminRestaurantsController();
