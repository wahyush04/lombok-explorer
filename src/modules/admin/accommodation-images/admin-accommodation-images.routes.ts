import { Router } from 'express';
import { adminAccommodationImagesController } from './admin-accommodation-images.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  CreateAccommodationImageSchema,
  UpdateAccommodationImageSchema,
} from './dto/admin-accommodation-image.dto';
import { accommodationImageParamsSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true });

// Apply authenticateAdmin across all accommodation image management routes
router.use(authenticateAdmin);

// 1. List all images for an accommodation
router.get(
  '/',
  validate({ params: accommodationImageParamsSchema }),
  asyncHandler(adminAccommodationImagesController.getImages),
);

// 2. Add an image to accommodation (accepts JSON asset metadata)
router.post(
  '/',
  validate({ params: accommodationImageParamsSchema, body: CreateAccommodationImageSchema }),
  asyncHandler(adminAccommodationImagesController.createImage),
);

// 3. Update an image (caption, altText, orderIndex, isPrimary, or new asset metadata)
router.put(
  '/:imageId',
  validate({ params: accommodationImageParamsSchema, body: UpdateAccommodationImageSchema }),
  asyncHandler(adminAccommodationImagesController.updateImage),
);

// 4. Delete an image from accommodation
router.delete(
  '/:imageId',
  validate({ params: accommodationImageParamsSchema }),
  asyncHandler(adminAccommodationImagesController.deleteImage),
);

export const adminAccommodationImageRoutes = router;
