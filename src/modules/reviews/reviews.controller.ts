import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { reviewsService, ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewQuery, UpdateReviewDto } from './dto/review.dto';

export class ReviewsController {
  constructor(private readonly service: ReviewsService = reviewsService) {}

  public getDestinationReviews = asyncHandler(async (req: Request, res: Response) => {
    const destinationId = req.params.id as string;
    const query = req.query as unknown as ReviewQuery;
    const { data, meta } = await this.service.getDestinationReviews(destinationId, query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching destination reviews');
  });

  public createDestinationReview = asyncHandler(async (req: Request, res: Response) => {
    const destinationId = req.params.id as string;
    const userId = req.user!.userId;
    const dto = req.body as CreateReviewDto;
    const data = await this.service.createDestinationReview(userId, destinationId, dto);
    return ResponseUtil.sendCreated(res, data, 'Review submitted successfully');
  });

  public updateReview = asyncHandler(async (req: Request, res: Response) => {
    const reviewId = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateReviewDto;
    const data = await this.service.updateReview(userId, userRole, reviewId, dto);
    return ResponseUtil.sendSuccess(res, data, 'Review updated successfully');
  });

  public deleteReview = asyncHandler(async (req: Request, res: Response) => {
    const reviewId = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    await this.service.deleteReview(userId, userRole, reviewId);
    return ResponseUtil.sendActionSuccess(res, 'Review deleted successfully');
  });
}

export const reviewsController = new ReviewsController();
