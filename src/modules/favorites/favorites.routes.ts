import { Router, Request, Response, NextFunction } from 'express';
import { favoritesController } from './favorites.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { FavoriteQuerySchema } from './dto/favorite.dto';

const router = Router();

// All favorites endpoints require authentication
router.use(authenticate);

// 1. Unified / Combined Favorites List
router.get(
  '/all',
  validate({ query: FavoriteQuerySchema }),
  favoritesController.getUnifiedFavorites,
);
router.get(
  '/combined',
  validate({ query: FavoriteQuerySchema }),
  favoritesController.getUnifiedFavorites,
);

// 2. Convenience Category Favorites
router.get(
  '/accommodations',
  (req: Request, _res: Response, next: NextFunction) => {
    req.query.type = 'ACCOMMODATION';
    next();
  },
  validate({ query: FavoriteQuerySchema }),
  favoritesController.getUnifiedFavorites,
);
router.get(
  '/restaurants',
  (req: Request, _res: Response, next: NextFunction) => {
    req.query.type = 'RESTAURANT';
    next();
  },
  validate({ query: FavoriteQuerySchema }),
  favoritesController.getUnifiedFavorites,
);

// 3. Accommodation Favorites Management (/favorites/accommodations/:id)
router.post('/accommodations/:id', favoritesController.addAccommodationFavorite);
router.delete('/accommodations/:id', favoritesController.removeAccommodationFavorite);

// 4. Restaurant Favorites Management (/favorites/restaurants/:id)
router.post('/restaurants/:id', favoritesController.addRestaurantFavorite);
router.delete('/restaurants/:id', favoritesController.removeRestaurantFavorite);

// 5. Root Favorites List (supports ?type=ALL|DESTINATION|ACCOMMODATION|RESTAURANT)
router.get(
  '/',
  validate({ query: FavoriteQuerySchema }),
  favoritesController.getFavorites,
);

// 6. Legacy Destination Favorites by ID
router.post('/:destinationId', favoritesController.addFavorite);
router.delete('/:destinationId', favoritesController.removeFavorite);

export const favoriteRoutes: Router = router;
