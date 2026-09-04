import { Request, Response } from 'express';
import {
  adminDestinationImagesService,
  AdminDestinationImagesService,
} from './admin-destination-images.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  CreateDestinationImageDto,
  UpdateDestinationImageDto,
} from './dto/admin-destination-image.dto';

export class AdminDestinationImagesController {
  constructor(
    private readonly service: AdminDestinationImagesService = adminDestinationImagesService,
  ) {}

  public getImages = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getDestinationImages(id as string);
    ResponseUtil.sendSuccess(res, data, 'Destination images retrieved successfully');
  };

  public createImage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as CreateDestinationImageDto;

    const data = await this.service.createDestinationImage(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Destination image created successfully');
  };

  public updateImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    const body = req.body as UpdateDestinationImageDto;

    const data = await this.service.updateDestinationImage(
      id as string,
      imageId as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Destination image updated successfully');
  };

  public deleteImage = async (req: Request, res: Response): Promise<void> => {
    const { id, imageId } = req.params;
    await this.service.deleteDestinationImage(
      id as string,
      imageId as string,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Destination image deleted successfully');
  };
}

export const adminDestinationImagesController = new AdminDestinationImagesController();
