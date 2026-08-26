import { Router } from 'express';
import { adminFeedsController } from './admin-feeds.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminReportFilterQuerySchema,
  AdminUpdatePostStatusSchema,
  AdminUpdateReportStatusSchema,
} from './dto/admin-feed.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Protect all admin feed routes with admin authentication
router.use(authenticateAdmin);

// 1. List feed reports with filters and pagination
router.get(
  '/reports',
  validate({ query: AdminReportFilterQuerySchema }),
  asyncHandler(adminFeedsController.getReports),
);

// 2. Get specific feed report detail by ID
router.get(
  '/reports/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminFeedsController.getReportById),
);

// 3. Update report status (REVIEWED, RESOLVED, DISMISSED)
router.patch(
  '/reports/:id',
  validate({ params: idParamSchema, body: AdminUpdateReportStatusSchema }),
  asyncHandler(adminFeedsController.updateReportStatus),
);

// 4. Moderate post status (PUBLISHED, HIDDEN, DELETED)
router.patch(
  '/posts/:id/status',
  validate({ params: idParamSchema, body: AdminUpdatePostStatusSchema }),
  asyncHandler(adminFeedsController.updatePostStatus),
);

export const adminFeedsRoutes: Router = router;
