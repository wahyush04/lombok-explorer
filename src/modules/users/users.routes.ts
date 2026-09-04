import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { generalLimiter } from '../../common/middleware/rate-limit.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { uploadFlexibleSingleImage } from '../storage/storage.middleware';
import { FeedQueryDtoSchema, feedsController } from '../feeds';
import { CheckUsernameQuerySchema, UpdateProfileSchema } from './dto/user.dto';
import { usersController } from './users.controller';

const router = Router();

// 1. Check Username Availability (Public, Rate-limited)
router.get(
  '/username/check',
  generalLimiter,
  validate({ query: CheckUsernameQuerySchema }),
  usersController.checkUsername,
);

// 2. Get Current User Profile (Authenticated)
router.get('/me', authenticate, usersController.getMe);

// 3. Update Current User Profile (Authenticated)
router.patch(
  '/me',
  authenticate,
  validate({ body: UpdateProfileSchema }),
  usersController.updateMe,
);

// 4. Upload User Avatar (Authenticated, Cloudinary)
router.post('/me/avatar', authenticate, uploadFlexibleSingleImage, usersController.uploadAvatar);

// 4. Public Profile Feed Posts
router.get(
  '/:userId/posts',
  optionalAuthenticate,
  validate({ query: FeedQueryDtoSchema }),
  feedsController.getUserPosts,
);

export { router as userRoutes };
