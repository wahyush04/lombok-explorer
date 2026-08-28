import { Router } from 'express';
import { itinerariesController } from './itineraries.controller';
import { expensesController } from '../expenses/expenses.controller';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { expensiveAiLimiter } from '../../common/middleware/rate-limit.middleware';
import {
  AddActivityDtoSchema,
  AddDayDtoSchema,
  CreateItineraryDtoSchema,
  ItineraryQuerySchema,
  OptimizeItineraryDtoSchema,
  ReorderActivitiesDtoSchema,
  UpdateActivityDtoSchema,
  UpdateDayDtoSchema,
  UpdateItineraryDtoSchema,
} from './dto/itinerary.dto';
import { GenerateItineraryDtoSchema } from './dto/itinerary-generator.dto';
import { CreateExpenseDtoSchema } from '../expenses/dto/expense.dto';

const router = Router();

// ==========================================
// 1. PUBLIC & SHARED TRIPS
// ==========================================
router.get('/shared/:shareToken', itinerariesController.getSharedItinerary);

// ==========================================
// 2. LIST & SMART GENERATOR
// ==========================================
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: ItineraryQuerySchema }),
  itinerariesController.getItineraries,
);

router.post(
  '/generate',
  expensiveAiLimiter,
  optionalAuthenticate,
  validate({ body: GenerateItineraryDtoSchema }),
  itinerariesController.generateItinerary,
);

// ==========================================
// 3. TRIP MASTER CRUD
// ==========================================
router.post(
  '/',
  authenticate,
  validate({ body: CreateItineraryDtoSchema }),
  itinerariesController.createItinerary,
);

router.get('/:id', optionalAuthenticate, itinerariesController.getById);

router.patch(
  '/:id',
  authenticate,
  validate({ body: UpdateItineraryDtoSchema }),
  itinerariesController.updateItinerary,
);

router.put(
  '/:id',
  authenticate,
  validate({ body: UpdateItineraryDtoSchema }),
  itinerariesController.updateItinerary,
);

router.delete('/:id', authenticate, itinerariesController.deleteItinerary);

router.post('/:id/duplicate', authenticate, itinerariesController.duplicateItinerary);

router.post('/:id/share', authenticate, itinerariesController.generateShareToken);

// ==========================================
// 4. DAY MANAGEMENT
// ==========================================
router.post(
  '/:id/days',
  authenticate,
  validate({ body: AddDayDtoSchema }),
  itinerariesController.addDay,
);

router.patch(
  '/:id/days/:dayId',
  authenticate,
  validate({ body: UpdateDayDtoSchema }),
  itinerariesController.updateDay,
);

router.delete(
  '/:id/days/:dayId',
  authenticate,
  itinerariesController.deleteDay,
);

// ==========================================
// 5. ACTIVITY / STOP MANAGEMENT
// ==========================================
router.post(
  '/:id/days/:dayId/activities',
  authenticate,
  validate({ body: AddActivityDtoSchema }),
  itinerariesController.addActivity,
);

router.put(
  '/:id/days/:dayId/activities',
  authenticate,
  validate({ body: ReorderActivitiesDtoSchema }),
  itinerariesController.reorderActivities,
);

router.patch(
  '/:id/days/:dayId/activities/:activityId',
  authenticate,
  validate({ body: UpdateActivityDtoSchema }),
  itinerariesController.updateActivity,
);

router.delete(
  '/:id/days/:dayId/activities/:activityId',
  authenticate,
  itinerariesController.deleteActivity,
);

// ==========================================
// 6. ROUTE OPTIMIZATION
// ==========================================
router.post(
  '/:id/optimize',
  authenticate,
  validate({ body: OptimizeItineraryDtoSchema }),
  itinerariesController.optimizeRoute,
);

// ==========================================
// 7. EXPENSES (PHASE 17 INTEGRATION)
// ==========================================
router.get('/:id/expenses', authenticate, expensesController.getItineraryExpenses);
router.post(
  '/:id/expenses',
  authenticate,
  validate({ body: CreateExpenseDtoSchema }),
  expensesController.addItineraryExpense,
);

export const itineraryRoutes: Router = router;
