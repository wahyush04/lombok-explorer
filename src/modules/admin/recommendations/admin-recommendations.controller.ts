import { Request, Response } from 'express';
import { adminRecommendationsService, AdminRecommendationsService } from './admin-recommendations.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { CreateAdminRecommendationDto, UpdateAdminRecommendationDto } from './dto/admin-recommendation.dto';

export class AdminRecommendationsController {
  constructor(private readonly service: AdminRecommendationsService = adminRecommendationsService) {}

  public getRecommendations = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getRecommendations();
    ResponseUtil.sendSuccess(res, data, 'Recommendations retrieved successfully');
  };

  public getRecommendationById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getRecommendationById(id as string);
    ResponseUtil.sendSuccess(res, data, 'Recommendation details retrieved successfully');
  };

  public createRecommendation = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateAdminRecommendationDto;
    const data = await this.service.createRecommendation(body);
    ResponseUtil.sendCreated(res, data, 'Recommendation created successfully');
  };

  public updateRecommendation = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateAdminRecommendationDto;
    const data = await this.service.updateRecommendation(id as string, body);
    ResponseUtil.sendSuccess(res, data, 'Recommendation updated successfully');
  };

  public deleteRecommendation = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.service.deleteRecommendation(id as string);
    ResponseUtil.sendActionSuccess(res, 'Recommendation deleted successfully');
  };
}

export const adminRecommendationsController = new AdminRecommendationsController();
