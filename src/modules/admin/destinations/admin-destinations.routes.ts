import { Router } from 'express';
import { adminDestinationsController } from './admin-destinations.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminDestinationFilterQuerySchema,
  BulkDeleteDestinationsSchema,
  BulkUpdateDestinationStatusSchema,
  CreateDestinationSchema,
  UpdateDestinationSchema,
  UpdateDestinationStatusSchema,
} from './dto/admin-destination.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { adminDestinationImageRoutes } from '../destination-images/admin-destination-images.routes';

const router = Router();

// Apply authenticateAdmin across all destination management endpoints
router.use(authenticateAdmin);

// Destination Images Sub-Router (/api/v1/admin/destinations/:id/images/*)
router.use('/:id/images', adminDestinationImageRoutes);

// 1. List & filter destinations (with pagination & sorting)
router.get(
  '/',
  validate({ query: AdminDestinationFilterQuerySchema }),
  asyncHandler(adminDestinationsController.getDestinations),
);

// 2. Bulk operations (Phase 12)
router.post(
  '/bulk-delete',
  validate({ body: BulkDeleteDestinationsSchema }),
  asyncHandler(adminDestinationsController.bulkDeleteDestinations),
);

router.post(
  '/bulk-status',
  validate({ body: BulkUpdateDestinationStatusSchema }),
  asyncHandler(adminDestinationsController.bulkUpdateDestinationStatus),
);

// 3. Get destination details by ID or slug
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminDestinationsController.getDestinationById),
);

// 4. Create new destination
router.post(
  '/',
  validate({ body: CreateDestinationSchema }),
  asyncHandler(adminDestinationsController.createDestination),
);

// 5. Update destination
router.put(
  '/:id',
  validate({ params: idParamSchema, body: UpdateDestinationSchema }),
  asyncHandler(adminDestinationsController.updateDestination),
);

// 6. Update destination status specifically
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: UpdateDestinationStatusSchema }),
  asyncHandler(adminDestinationsController.updateDestinationStatus),
);

// 7. Delete destination (supports ?hard=true for permanent deletion)
router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminDestinationsController.deleteDestination),
);

export const adminDestinationRoutes = router;
