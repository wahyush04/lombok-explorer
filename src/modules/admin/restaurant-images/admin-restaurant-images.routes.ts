import { Router } from 'express';
import { adminRestaurantImagesController } from './admin-restaurant-images.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  CreateRestaurantImageSchema,
  UpdateRestaurantImageSchema,
} from './dto/admin-restaurant-image.dto';
import { restaurantImageParamsSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true });

// Apply authenticateAdmin across all restaurant image management routes
router.use(authenticateAdmin);

// 1. List all images for a restaurant
router.get(
  '/',
  validate({ params: restaurantImageParamsSchema }),
  asyncHandler(adminRestaurantImagesController.getImages),
);

// 2. Add an image to restaurant (accepts JSON asset metadata)
router.post(
  '/',
  validate({ params: restaurantImageParamsSchema, body: CreateRestaurantImageSchema }),
  asyncHandler(adminRestaurantImagesController.createImage),
);

// 3. Update an image (caption, altText, orderIndex, isPrimary, or new asset metadata)
router.put(
  '/:imageId',
  validate({ params: restaurantImageParamsSchema, body: UpdateRestaurantImageSchema }),
  asyncHandler(adminRestaurantImagesController.updateImage),
);

// 4. Delete an image from restaurant
router.delete(
  '/:imageId',
  validate({ params: restaurantImageParamsSchema }),
  asyncHandler(adminRestaurantImagesController.deleteImage),
);

export const adminRestaurantImageRoutes = router;
