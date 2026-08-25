import { Router } from 'express';
import { adminAccommodationsController } from './admin-accommodations.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminAccommodationFilterQuerySchema,
  CreateAccommodationSchema,
  DeleteAccommodationQuerySchema,
  UpdateAccommodationSchema,
  UpdateAccommodationStatusSchema,
} from './dto/admin-accommodation.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
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
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminAccommodationsController.getAccommodationById),
);

// 3. Create accommodation
router.post(
  '/',
  validate({ body: CreateAccommodationSchema }),
  asyncHandler(adminAccommodationsController.createAccommodation),
);

// 4. Update accommodation
router.put(
  '/:id',
  validate({ params: idParamSchema, body: UpdateAccommodationSchema }),
  asyncHandler(adminAccommodationsController.updateAccommodation),
);

// 5. Update accommodation status specifically
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: UpdateAccommodationStatusSchema }),
  asyncHandler(adminAccommodationsController.updateAccommodationStatus),
);

// 6. Delete accommodation (supports ?hard=true)
router.delete(
  '/:id',
  validate({ params: idParamSchema, query: DeleteAccommodationQuerySchema }),
  asyncHandler(adminAccommodationsController.deleteAccommodation),
);

export const adminAccommodationRoutes = router;
