import { Request, Response } from 'express';
import {
  adminAccommodationImagesService,
  AdminAccommodationImagesService,
} from './admin-accommodation-images.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  CreateAccommodationImageDto,
  UpdateAccommodationImageDto,
} from './dto/admin-accommodation-image.dto';

export class AdminAccommodationImagesController {
  constructor(
    private readonly service: AdminAccommodationImagesService = adminAccommodationImagesService,
  ) {}

  public getImages = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getAccommodationImages(id as string);
    ResponseUtil.sendSuccess(res, data, 'Accommodation images retrieved successfully');
  };

  public createImage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as CreateAccommodationImageDto;

    const data = await this.service.createAccommodationImage(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Accommodation image created successfully');
  };

  public updateImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    const body = req.body as UpdateAccommodationImageDto;

    const data = await this.service.updateAccommodationImage(
      id as string,
      imageId as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Accommodation image updated successfully');
  };

  public deleteImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    await this.service.deleteAccommodationImage(
      id as string,
      imageId as string,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Accommodation image deleted successfully');
  };
}

export const adminAccommodationImagesController = new AdminAccommodationImagesController();
