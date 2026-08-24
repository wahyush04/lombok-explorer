import { Router } from 'express';
import { destinationsController } from './destinations.controller';
import { reviewsController } from '../reviews/reviews.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import {
  DestinationFilterQuerySchema,
  NearbyDestinationQuerySchema,
  SearchDestinationQuerySchema,
} from './dto/destination.dto';
import { CreateReviewDtoSchema, ReviewQuerySchema } from '../reviews/dto/review.dto';

const router = Router();

// 1. List with pagination, filters (category, region, difficulty, rating, price, tags), and sorting
router.get(
  '/',
  validate({ query: DestinationFilterQuerySchema }),
  destinationsController.getDestinations,
);

// 2. Specific static endpoints MUST precede dynamic /:id
router.get('/featured', destinationsController.getFeatured);
router.get(
  '/nearby',
  validate({ query: NearbyDestinationQuerySchema }),
  destinationsController.getNearby,
);
router.get(
  '/search',
  validate({ query: SearchDestinationQuerySchema }),
  destinationsController.search,
);

// 3. Destination Reviews (GET /destinations/:id/reviews & POST /destinations/:id/reviews)
router.get(
  '/:id/reviews',
  validate({ query: ReviewQuerySchema }),
  reviewsController.getDestinationReviews,
);
router.post(
  '/:id/reviews',
  authenticate,
  validate({ body: CreateReviewDtoSchema }),
  reviewsController.createDestinationReview,
);

// 4. Detail by ID or Slug
router.get('/:id', destinationsController.getByIdOrSlug);

export const destinationRoutes: Router = router;
