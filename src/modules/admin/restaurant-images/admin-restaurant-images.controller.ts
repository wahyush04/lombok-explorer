import { Request, Response } from 'express';
import {
  adminRestaurantImagesService,
  AdminRestaurantImagesService,
} from './admin-restaurant-images.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  CreateRestaurantImageDto,
  UpdateRestaurantImageDto,
} from './dto/admin-restaurant-image.dto';

export class AdminRestaurantImagesController {
  constructor(
    private readonly service: AdminRestaurantImagesService = adminRestaurantImagesService,
  ) {}

  public getImages = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getRestaurantImages(id as string);
    ResponseUtil.sendSuccess(res, data, 'Restaurant images retrieved successfully');
  };

  public createImage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as CreateRestaurantImageDto;

    const data = await this.service.createRestaurantImage(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Restaurant image created successfully');
  };

  public updateImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    const body = req.body as UpdateRestaurantImageDto;

    const data = await this.service.updateRestaurantImage(
      id as string,
      imageId as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Restaurant image updated successfully');
  };

  public deleteImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    await this.service.deleteRestaurantImage(
      id as string,
      imageId as string,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Restaurant image deleted successfully');
  };
}

export const adminRestaurantImagesController = new AdminRestaurantImagesController();
