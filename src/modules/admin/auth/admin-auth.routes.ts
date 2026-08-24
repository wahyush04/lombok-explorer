import { Router } from 'express';
import { adminAuthController } from './admin-auth.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import { LoginDtoSchema, RefreshTokenDtoSchema } from '../../auth/dto/auth.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { authLimiter } from '../../../common/middleware/rate-limit.middleware';

const router = Router();

// 1. Admin Login (rate limited & schema validated)
router.post(
  '/login',
  authLimiter,
  validate(LoginDtoSchema),
  asyncHandler(adminAuthController.login),
);

// 2. Admin Token Refresh (schema validated)
router.post(
  '/refresh',
  authLimiter,
  validate(RefreshTokenDtoSchema),
  asyncHandler(adminAuthController.refreshToken),
);

// 3. Admin Logout (requires active admin token)
router.post('/logout', authenticateAdmin, asyncHandler(adminAuthController.logout));

// 4. Admin Profile (requires active admin token)
router.get('/me', authenticateAdmin, asyncHandler(adminAuthController.getMe));

export const adminAuthRoutes = router;
