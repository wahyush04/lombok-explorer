import { Router } from 'express';
import { itinerariesController } from './itineraries.controller';
import { expensesController } from '../expenses/expenses.controller';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { expensiveAiLimiter } from '../../common/middleware/rate-limit.middleware';
import {
  CreateItineraryDtoSchema,
  ItineraryQuerySchema,
  UpdateItineraryDtoSchema,
} from './dto/itinerary.dto';
import { GenerateItineraryDtoSchema } from './dto/itinerary-generator.dto';
import { CreateExpenseDtoSchema } from '../expenses/dto/expense.dto';

const router = Router();

// 1. List itineraries (supports public browsing and user saved itineraries)
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: ItineraryQuerySchema }),
  itinerariesController.getItineraries,
);

// 2. Smart Itinerary Generator Engine (POST /itineraries/generate) with specific heavy AI rate limiter
router.post(
  '/generate',
  expensiveAiLimiter,
  optionalAuthenticate,
  validate({ body: GenerateItineraryDtoSchema }),
  itinerariesController.generateItinerary,
);

// 3. Create new manual itinerary (Multi-day with database transaction)
router.post(
  '/',
  authenticate,
  validate({ body: CreateItineraryDtoSchema }),
  itinerariesController.createItinerary,
);

// 4. Get itinerary expenses & budget breakdown (Phase 17)
router.get('/:id/expenses', authenticate, expensesController.getItineraryExpenses);

// 5. Add expense to itinerary (Phase 17)
router.post(
  '/:id/expenses',
  authenticate,
  validate({ body: CreateExpenseDtoSchema }),
  expensesController.addItineraryExpense,
);

// 6. Get itinerary detail by ID
router.get('/:id', optionalAuthenticate, itinerariesController.getById);

// 7. Update itinerary
router.put(
  '/:id',
  authenticate,
  validate({ body: UpdateItineraryDtoSchema }),
  itinerariesController.updateItinerary,
);

// 8. Delete itinerary
router.delete('/:id', authenticate, itinerariesController.deleteItinerary);

export const itineraryRoutes: Router = router;
