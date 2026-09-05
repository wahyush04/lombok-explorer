import { Router } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { notificationsController } from './notifications.controller';
import { NotificationQuerySchema } from './dto/notification.dto';

const router = Router();

// 1. Get Unread Count (must precede parameterized routes)
router.get('/unread-count', authenticate, notificationsController.getUnreadCount);

// 2. Mark All Notifications as Read (must precede parameterized routes)
router.patch('/read-all', authenticate, notificationsController.markAllAsRead);

// 3. Mark Single Notification as Read
router.patch('/:id/read', authenticate, notificationsController.markAsRead);

// 4. Get List of Notifications (Paginated, Unread Filter)
router.get(
  '/',
  authenticate,
  validate({ query: NotificationQuerySchema }),
  notificationsController.getNotifications,
);

export const notificationRoutes: Router = router;
