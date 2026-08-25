import { Router } from 'express';
import { adminRestaurantsController } from './admin-restaurants.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminRestaurantFilterQuerySchema,
  CreateRestaurantSchema,
  DeleteRestaurantQuerySchema,
  UpdateRestaurantSchema,
  UpdateRestaurantStatusSchema,
} from './dto/admin-restaurant.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Apply authenticateAdmin across all restaurant management routes
router.use(authenticateAdmin);

// 1. List & filter restaurants
router.get(
  '/',
  validate({ query: AdminRestaurantFilterQuerySchema }),
  asyncHandler(adminRestaurantsController.getRestaurants),
);

// 2. Get restaurant by ID or slug
router.get('/:id', asyncHandler(adminRestaurantsController.getRestaurantById));

// 3. Create restaurant
router.post(
  '/',
  validate(CreateRestaurantSchema),
  asyncHandler(adminRestaurantsController.createRestaurant),
);

// 4. Update restaurant
router.put(
  '/:id',
  validate(UpdateRestaurantSchema),
  asyncHandler(adminRestaurantsController.updateRestaurant),
);

// 5. Update restaurant status specifically
router.patch(
  '/:id/status',
  validate(UpdateRestaurantStatusSchema),
  asyncHandler(adminRestaurantsController.updateRestaurantStatus),
);

// 6. Delete restaurant (supports ?hard=true)
router.delete(
  '/:id',
  validate({ query: DeleteRestaurantQuerySchema }),
  asyncHandler(adminRestaurantsController.deleteRestaurant),
);

export const adminRestaurantRoutes = router;
