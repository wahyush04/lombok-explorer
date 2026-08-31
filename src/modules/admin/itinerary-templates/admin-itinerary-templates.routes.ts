import { Router } from 'express';
import { adminItineraryTemplatesController } from './admin-itinerary-templates.controller';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminTemplateFilterQuerySchema,
  CreateItineraryTemplateSchema,
  UpdateItineraryTemplateSchema,
} from './dto/admin-itinerary-template.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';

const router = Router();

// Enforce admin authentication across all template administration endpoints
router.use(authenticateAdmin);

// 1. List & filter templates (with pagination, published/featured filters, sorting)
router.get(
  '/',
  validate({ query: AdminTemplateFilterQuerySchema }),
  adminItineraryTemplatesController.getTemplates,
);

// 2. Get template by ID
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  adminItineraryTemplatesController.getTemplateById,
);

// 3. Create new curated template
router.post(
  '/',
  validate({ body: CreateItineraryTemplateSchema }),
  adminItineraryTemplatesController.createTemplate,
);

// 4. Update template
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: UpdateItineraryTemplateSchema }),
  adminItineraryTemplatesController.updateTemplate,
);

router.put(
  '/:id',
  validate({ params: idParamSchema, body: UpdateItineraryTemplateSchema }),
  adminItineraryTemplatesController.updateTemplate,
);

// 5. Delete template
router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  adminItineraryTemplatesController.deleteTemplate,
);

export const adminItineraryTemplateRoutes = router;
