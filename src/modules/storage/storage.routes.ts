import { Router } from 'express';
import { storageController } from './storage.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { uploadFlexibleSingleImage, uploadMultipleImages } from './storage.middleware';

const router = Router();

// ==========================================
// CENTRALIZED MEDIA ENDPOINTS (/api/v1/media or /api/v1/storage)
// ==========================================

// POST /media/images & POST /storage/upload (Upload single image)
router.post('/images', authenticate, uploadFlexibleSingleImage, storageController.uploadSingle);
router.post('/upload', authenticate, uploadFlexibleSingleImage, storageController.uploadSingle);

// POST /media/images/multiple & POST /storage/upload-multiple (Upload up to 10 images)
router.post(
  '/images/multiple',
  authenticate,
  uploadMultipleImages,
  storageController.uploadMultiple,
);
router.post(
  '/upload-multiple',
  authenticate,
  uploadMultipleImages,
  storageController.uploadMultiple,
);

// DELETE /media/images & DELETE /storage/delete (Delete stored image by publicId or fileUrl)
router.delete('/images', authenticate, storageController.deleteFile);
router.delete('/delete', authenticate, storageController.deleteFile);

export const storageRoutes: Router = router;
export const mediaRoutes: Router = router;
