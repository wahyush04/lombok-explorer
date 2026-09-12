import { Router } from 'express';
import { adminTripSessionsController } from './admin-trip-sessions.controller';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validate.middleware';
import { AdminTripSessionFilterQuerySchema } from './dto/admin-trip-session.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';

const router = Router();

router.use(authenticateAdmin);

// 1. Live Map Coordinates for active travelers
router.get('/live-map', asyncHandler(adminTripSessionsController.getLiveMapPoints));

// 2. List & Filter all trip sessions
router.get(
  '/',
  validate({ query: AdminTripSessionFilterQuerySchema }),
  asyncHandler(adminTripSessionsController.getTripSessions),
);

// 3. Detail of a single trip session
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminTripSessionsController.getTripSessionById),
);

export const adminTripSessionRoutes: Router = router;
