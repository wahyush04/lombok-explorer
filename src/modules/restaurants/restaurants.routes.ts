import { Router } from 'express';
import { restaurantsController } from './restaurants.controller';
import { validate } from '../../common/middleware/validate.middleware';
import { RestaurantFilterQuerySchema } from './dto/restaurant.dto';

const router = Router();

// 1. List with pagination, filters (region, cuisineType, min/max price, rating, halal), and sorting
router.get(
  '/',
  validate({ query: RestaurantFilterQuerySchema }),
  restaurantsController.getRestaurants,
);

// 2. Featured Restaurants & Culinary
router.get('/featured', restaurantsController.getFeatured);

// 3. Detail by ID or Slug
router.get('/:id', restaurantsController.getByIdOrSlug);

export const restaurantRoutes: Router = router;
