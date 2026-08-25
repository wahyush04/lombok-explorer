import { Router } from 'express';
import { adminDestinationsController } from './admin-destinations.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminDestinationFilterQuerySchema,
  CreateDestinationSchema,
  UpdateDestinationSchema,
} from './dto/admin-destination.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Apply authenticateAdmin across all destination management endpoints
router.use(authenticateAdmin);

// 1. List & filter destinations (with pagination & sorting)
router.get(
  '/',
  validate({ query: AdminDestinationFilterQuerySchema }),
  asyncHandler(adminDestinationsController.getDestinations),
);

// 2. Get destination details by ID or slug
router.get('/:id', asyncHandler(adminDestinationsController.getDestinationById));

// 3. Create new destination
router.post(
  '/',
  validate(CreateDestinationSchema),
  asyncHandler(adminDestinationsController.createDestination),
);

// 4. Update destination
router.put(
  '/:id',
  validate(UpdateDestinationSchema),
  asyncHandler(adminDestinationsController.updateDestination),
);

// 5. Delete destination (supports ?hard=true for permanent deletion)
router.delete('/:id', asyncHandler(adminDestinationsController.deleteDestination));

export const adminDestinationRoutes = router;
