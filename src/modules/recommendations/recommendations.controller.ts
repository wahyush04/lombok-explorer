import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { recommendationsService, RecommendationsService } from './recommendations.service';
import { RecommendationQuery } from './dto/recommendation.dto';

export class RecommendationsController {
  constructor(private readonly service: RecommendationsService = recommendationsService) {}

  public getRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as RecommendationQuery;
    const userId = req.user?.userId;

    const data = await this.service.getRecommendations(query, userId);
    return ResponseUtil.sendSuccess(res, data, 'Success fetching curated recommendations');
  });
}

export const recommendationsController = new RecommendationsController();
