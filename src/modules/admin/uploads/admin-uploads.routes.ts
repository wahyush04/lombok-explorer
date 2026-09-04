import { Router } from 'express';
import { adminUploadsController } from './admin-uploads.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import { AdminUploadSignatureRequestSchema } from './dto/admin-uploads.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Require admin authentication for all upload operations
router.use(authenticateAdmin);

// POST /api/v1/admin/uploads/signature
router.post(
  '/signature',
  validate({ body: AdminUploadSignatureRequestSchema }),
  asyncHandler(adminUploadsController.generateSignature),
);

export const adminUploadsRoutes = router;
