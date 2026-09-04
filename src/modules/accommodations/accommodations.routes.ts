import { Router } from 'express';
import { accommodationsController } from './accommodations.controller';
import { validate } from '../../common/middleware/validate.middleware';
import { AccommodationFilterQuerySchema } from './dto/accommodation.dto';

const router = Router();

// 1. List with pagination, filters (region, type, min/max price, rating, amenity), and sorting
router.get(
  '/',
  validate({ query: AccommodationFilterQuerySchema }),
  accommodationsController.getAccommodations,
);

// 2. Featured Accommodations
router.get('/featured', accommodationsController.getFeatured);

// 3. Detail by ID or Slug
router.get('/:id', accommodationsController.getByIdOrSlug);

export const accommodationRoutes: Router = router;
