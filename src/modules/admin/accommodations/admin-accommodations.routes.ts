import { Router } from 'express';
import { adminAccommodationsController } from './admin-accommodations.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminAccommodationFilterQuerySchema,
  CreateAccommodationSchema,
  DeleteAccommodationQuerySchema,
  UpdateAccommodationSchema,
} from './dto/admin-accommodation.dto';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Apply authenticateAdmin across all accommodation management routes
router.use(authenticateAdmin);

// 1. List & filter accommodations
router.get(
  '/',
  validate({ query: AdminAccommodationFilterQuerySchema }),
  asyncHandler(adminAccommodationsController.getAccommodations),
);

// 2. Get accommodation by ID or slug
router.get('/:id', asyncHandler(adminAccommodationsController.getAccommodationById));

// 3. Create accommodation
router.post(
  '/',
  validate(CreateAccommodationSchema),
  asyncHandler(adminAccommodationsController.createAccommodation),
);

// 4. Update accommodation
router.put(
  '/:id',
  validate(UpdateAccommodationSchema),
  asyncHandler(adminAccommodationsController.updateAccommodation),
);

// 5. Delete accommodation (supports ?hard=true)
router.delete(
  '/:id',
  validate({ query: DeleteAccommodationQuerySchema }),
  asyncHandler(adminAccommodationsController.deleteAccommodation),
);

export const adminAccommodationRoutes = router;
