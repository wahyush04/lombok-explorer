import { Router } from 'express';
import { adminDestinationImagesController } from './admin-destination-images.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  CreateDestinationImageSchema,
  UpdateDestinationImageSchema,
} from './dto/admin-destination-image.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { uploadSingleImageField } from '../../storage/storage.middleware';

const router = Router({ mergeParams: true });

// Apply authenticateAdmin across all destination image management routes
router.use(authenticateAdmin);

// 1. List all images for a destination
router.get('/', asyncHandler(adminDestinationImagesController.getImages));

// 2. Add an image to destination (accepts multipart/form-data with 'image' field or JSON with imageUrl)
router.post(
  '/',
  uploadSingleImageField('image'),
  validate(CreateDestinationImageSchema),
  asyncHandler(adminDestinationImagesController.createImage),
);

// 3. Update an image (caption, altText, orderIndex, isPrimary, or new file upload)
router.put(
  '/:imageId',
  uploadSingleImageField('image'),
  validate(UpdateDestinationImageSchema),
  asyncHandler(adminDestinationImagesController.updateImage),
);

// 4. Delete an image from destination
router.delete('/:imageId', asyncHandler(adminDestinationImagesController.deleteImage));

export const adminDestinationImageRoutes = router;
