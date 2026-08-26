import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../common/middleware/validate.middleware';
import {
  CompleteGoogleRegistrationDtoSchema,
  GoogleAuthDtoSchema,
  LoginDtoSchema,
  RefreshTokenDtoSchema,
  RegisterDtoSchema,
} from './dto/auth.dto';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authLimiter } from '../../common/middleware/rate-limit.middleware';

const router = Router();

// Apply auth rate limiter to all auth routes (brute-force protection)
router.use(authLimiter);

// Public routes
router.post('/register', validate(RegisterDtoSchema), authController.register);
router.post('/login', validate(LoginDtoSchema), authController.login);
router.post('/google', validate(GoogleAuthDtoSchema), authController.googleLogin);
router.post(
  '/google/register',
  validate(CompleteGoogleRegistrationDtoSchema),
  authController.completeGoogleRegistration,
);
router.post('/refresh', validate(RefreshTokenDtoSchema), authController.refresh);
router.post('/refresh-token', validate(RefreshTokenDtoSchema), authController.refresh);

// Protected routes (Requires valid JWT Access Token)
router.post('/google/link', authenticate, validate(GoogleAuthDtoSchema), authController.linkGoogle);
router.delete('/google/link', authenticate, authController.unlinkGoogle);
router.get('/providers', authenticate, authController.getAuthProviders);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

export const authRoutes: Router = router;
