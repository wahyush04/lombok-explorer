import { Router } from 'express';
import { restaurantsController } from './restaurants.controller';
import { favoritesController } from '../favorites/favorites.controller';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { RestaurantFilterQuerySchema } from './dto/restaurant.dto';

const router = Router();

// 1. List with pagination, filters (region, cuisineType, min/max price, rating, halal), and sorting
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: RestaurantFilterQuerySchema }),
  restaurantsController.getRestaurants,
);

// 2. Featured Restaurants & Culinary
router.get('/featured', optionalAuthenticate, restaurantsController.getFeatured);

// 3. Restaurant Favorite Operations (/restaurants/:id/favorite)
router.post('/:id/favorite', authenticate, favoritesController.toggleRestaurantFavorite);
router.delete('/:id/favorite', authenticate, favoritesController.removeRestaurantFavorite);
router.get('/:id/favorite', authenticate, favoritesController.getRestaurantFavoriteStatus);

// 4. Detail by ID or Slug (Guest can view; if authenticated, isFavorite is populated)
router.get('/:id', optionalAuthenticate, restaurantsController.getByIdOrSlug);

export const restaurantRoutes: Router = router;
