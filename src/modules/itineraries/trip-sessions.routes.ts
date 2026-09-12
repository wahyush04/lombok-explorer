import { Router } from 'express';
import { tripSessionsController } from './trip-sessions.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import {
  CompleteActivityDtoSchema,
  StartTripDtoSchema,
  SyncLocationDtoSchema,
} from './dto/trip-session.dto';

const router = Router();

// Start a trip session (alternative path to POST /api/v1/itineraries/:id/start-trip)
router.post(
  '/start',
  authenticate,
  validate({ body: StartTripDtoSchema }),
  tripSessionsController.startTrip,
);

// Active trip session recovery for mobile
router.get('/active', authenticate, tripSessionsController.getActiveSession);

// Get trip session details
router.get('/:id', authenticate, tripSessionsController.getSessionById);

// Location synchronization & arrival auto-completion
router.post(
  '/:id/location',
  authenticate,
  validate({ body: SyncLocationDtoSchema }),
  tripSessionsController.syncLocation,
);

// Dedicated activity completion
router.post(
  '/:id/activities/:activityId/complete',
  authenticate,
  validate({ body: CompleteActivityDtoSchema }),
  tripSessionsController.completeActivity,
);

// Finish trip session manually
router.post('/:id/finish', authenticate, tripSessionsController.finishTrip);

// Cancel trip session
router.post('/:id/cancel', authenticate, tripSessionsController.cancelTrip);

export const tripSessionRoutes: Router = router;
