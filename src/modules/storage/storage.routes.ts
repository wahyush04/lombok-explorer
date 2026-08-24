import { Router } from 'express';
import { storageController } from './storage.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { uploadSingleImage, uploadMultipleImages } from './storage.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { DeleteFileDtoSchema } from './dto/storage.dto';

const router = Router();

// POST /storage/upload (Upload single image)
router.post('/upload', authenticate, uploadSingleImage, storageController.uploadSingle);

// POST /storage/upload-multiple (Upload up to 10 images)
router.post(
  '/upload-multiple',
  authenticate,
  uploadMultipleImages,
  storageController.uploadMultiple,
);

// DELETE /storage/delete (Delete stored image)
router.delete(
  '/delete',
  authenticate,
  validate({ body: DeleteFileDtoSchema }),
  storageController.deleteFile,
);

export const storageRoutes: Router = router;
