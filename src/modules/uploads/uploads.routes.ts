import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { uploadsController } from './uploads.controller';

const router = Router();

// ==========================================
// CLOUDINARY SIGNED UPLOADS ENDPOINTS
// ==========================================

// POST /api/v1/uploads/signature
router.post('/signature', authenticate, uploadsController.getSignature);

export const uploadRoutes: Router = router;
export const uploadsRoutes: Router = router;
