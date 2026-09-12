import { Router } from 'express';
import { adminNotificationsController } from './admin-notifications.controller';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validate.middleware';
import { AdminBroadcastNotificationSchema } from './dto/admin-notification.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';

const router = Router();

router.use(authenticateAdmin);

// 1. Get Push Notification & Registered Device Stats
router.get('/stats', asyncHandler(adminNotificationsController.getStats));

// 2. Dispatch Broadcast Push Notification
router.post(
  '/broadcast',
  validate({ body: AdminBroadcastNotificationSchema }),
  asyncHandler(adminNotificationsController.sendBroadcast),
);

export const adminNotificationRoutes: Router = router;
