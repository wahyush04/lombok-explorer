import { Router } from 'express';
import { adminAuditLogsController } from './admin-audit-logs.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import { AdminAuditLogFilterQuerySchema } from './dto/admin-audit-log.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Protect all audit log endpoints with admin authentication & authorization
router.use(authenticateAdmin);

// 1. List audit logs with multi-dimensional filtering & pagination
router.get(
  '/',
  validate({ query: AdminAuditLogFilterQuerySchema }),
  asyncHandler(adminAuditLogsController.getAuditLogs),
);

// 2. Get specific audit log detail by ID
router.get('/:id', asyncHandler(adminAuditLogsController.getAuditLogById));

export const adminAuditLogRoutes = router;
