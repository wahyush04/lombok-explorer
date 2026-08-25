import { Router } from 'express';
import { adminReviewsController } from './admin-reviews.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import { AdminReviewFilterQuerySchema, ReviewModerationSchema } from './dto/admin-review.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Protect all admin review routes with admin authentication
router.use(authenticateAdmin);

// 1. List reviews with pagination, status, and search filters
router.get(
  '/',
  validate({ query: AdminReviewFilterQuerySchema }),
  asyncHandler(adminReviewsController.getReviews),
);

// 2. Get specific review by ID
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminReviewsController.getReviewById),
);

// 3. Moderate review (APPROVED, REJECTED, PENDING)
router.patch(
  '/:id/moderate',
  validate({ params: idParamSchema, body: ReviewModerationSchema }),
  asyncHandler(adminReviewsController.moderateReview),
);

// Alias /:id/status for consistency
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: ReviewModerationSchema }),
  asyncHandler(adminReviewsController.moderateReview),
);

// 4. Delete review
router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminReviewsController.deleteReview),
);

export const adminReviewRoutes = router;
