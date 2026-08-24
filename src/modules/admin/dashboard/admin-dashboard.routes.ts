import { Router } from 'express';
import { adminDashboardController } from './admin-dashboard.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import { DashboardQuerySchema } from './dto/admin-dashboard.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// GET /api/v1/admin/dashboard (requires ADMIN privileges)
router.get(
  '/',
  authenticateAdmin,
  validate({ query: DashboardQuerySchema }),
  asyncHandler(adminDashboardController.getDashboard),
);

export const adminDashboardRoutes = router;
