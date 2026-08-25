import { Request, Response } from 'express';
import { adminReviewsService, AdminReviewsService } from './admin-reviews.service';
import { AdminReviewFilterQuery, ReviewModerationDto } from './dto/admin-review.dto';
import { ResponseUtil } from '../../../common/utils/api-response.util';

export class AdminReviewsController {
  constructor(private readonly service: AdminReviewsService = adminReviewsService) {}

  public getReviews = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminReviewFilterQuery;
    const result = await this.service.getReviews(query);

    ResponseUtil.sendPaginated(
      res,
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      'Reviews retrieved successfully',
    );
  };

  public getReviewById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const review = await this.service.getReviewById(id as string);
    ResponseUtil.sendSuccess(res, review, 'Review retrieved successfully', 200);
  };

  public moderateReview = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const adminId = req.user?.userId;
    const body = req.body as ReviewModerationDto;

    const updated = await this.service.moderateReview(id as string, body, adminId);
    ResponseUtil.sendSuccess(res, updated, `Review status updated to ${body.status}`, 200);
  };

  public deleteReview = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const adminId = req.user?.userId;

    await this.service.deleteReview(id as string, adminId);
    ResponseUtil.sendSuccess(res, null, 'Review deleted successfully', 200);
  };
}

export const adminReviewsController = new AdminReviewsController();
