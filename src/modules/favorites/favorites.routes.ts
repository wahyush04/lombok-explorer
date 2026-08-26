import { Router } from 'express';
import { favoritesController } from './favorites.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { FavoriteQuerySchema } from './dto/favorite.dto';

const router = Router();

// All favorites endpoints require authentication
router.use(authenticate);

router.get('/', validate({ query: FavoriteQuerySchema }), favoritesController.getFavorites);
router.post('/:destinationId', favoritesController.addFavorite);
router.delete('/:destinationId', favoritesController.removeFavorite);

export const favoriteRoutes: Router = router;
