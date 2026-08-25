import { Router } from 'express';
import { adminUsersController } from './admin-users.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminUserFilterQuerySchema,
  DeleteUserQuerySchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
} from './dto/admin-user.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Apply authenticateAdmin across all user management routes
router.use(authenticateAdmin);

// 1. List & filter users
router.get(
  '/',
  validate({ query: AdminUserFilterQuerySchema }),
  asyncHandler(adminUsersController.getUsers),
);

// 2. Get user by ID
router.get('/:id', asyncHandler(adminUsersController.getUserById));

// 3. Update user profile & role & status
router.put('/:id', validate(UpdateUserSchema), asyncHandler(adminUsersController.updateUser));

// 4. Update user status specifically (e.g. ACTIVE, SUSPENDED)
router.patch(
  '/:id/status',
  validate(UpdateUserStatusSchema),
  asyncHandler(adminUsersController.updateUserStatus),
);

// 5. Delete user (supports ?hard=true)
router.delete(
  '/:id',
  validate({ query: DeleteUserQuerySchema }),
  asyncHandler(adminUsersController.deleteUser),
);

export const adminUserRoutes = router;
