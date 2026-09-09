import { Router } from 'express';
import { accommodationsController } from './accommodations.controller';
import { favoritesController } from '../favorites/favorites.controller';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { AccommodationFilterQuerySchema } from './dto/accommodation.dto';

const router = Router();

// 1. List with pagination, filters (region, type, min/max price, rating, amenity), and sorting
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: AccommodationFilterQuerySchema }),
  accommodationsController.getAccommodations,
);

// 2. Featured Accommodations
router.get('/featured', optionalAuthenticate, accommodationsController.getFeatured);

// 3. Accommodation Favorite Operations (/accommodations/:id/favorite)
router.post('/:id/favorite', authenticate, favoritesController.toggleAccommodationFavorite);
router.delete('/:id/favorite', authenticate, favoritesController.removeAccommodationFavorite);
router.get('/:id/favorite', authenticate, favoritesController.getAccommodationFavoriteStatus);

// 4. Detail by ID or Slug (Guest can view; if authenticated, isFavorite is populated)
router.get('/:id', optionalAuthenticate, accommodationsController.getByIdOrSlug);

export const accommodationRoutes: Router = router;
