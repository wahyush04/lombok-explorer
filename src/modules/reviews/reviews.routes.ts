import { Router } from 'express';
import { reviewsController } from './reviews.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { UpdateReviewDtoSchema } from './dto/review.dto';

const router = Router();

// All standalone /reviews endpoints require authentication
router.use(authenticate);

// PUT /reviews/:id - Update review
router.put('/:id', validate({ body: UpdateReviewDtoSchema }), reviewsController.updateReview);

// DELETE /reviews/:id - Delete review
router.delete('/:id', reviewsController.deleteReview);

export const reviewRoutes: Router = router;
