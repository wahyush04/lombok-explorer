import { Router } from 'express';
import { adminCategoriesController } from './admin-categories.controller';
import { validate } from '../../../common/middleware/validate.middleware';
import {
  AdminCategoryFilterQuerySchema,
  CreateCategorySchema,
  DeleteCategoryQuerySchema,
  UpdateCategorySchema,
  UpdateCategoryStatusSchema,
} from './dto/admin-category.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';

const router = Router();

// Apply authenticateAdmin across all category management endpoints
router.use(authenticateAdmin);

// 1. List categories (with pagination, search, sorting)
router.get(
  '/',
  validate({ query: AdminCategoryFilterQuerySchema }),
  asyncHandler(adminCategoriesController.getCategories),
);

// 2. Get category details by ID or slug
router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(adminCategoriesController.getCategoryById),
);

// 3. Create new category (validates unique name & slug)
router.post(
  '/',
  validate({ body: CreateCategorySchema }),
  asyncHandler(adminCategoriesController.createCategory),
);

// 4. Update category
router.put(
  '/:id',
  validate({ params: idParamSchema, body: UpdateCategorySchema }),
  asyncHandler(adminCategoriesController.updateCategory),
);

// 5. Update category status specifically
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: UpdateCategoryStatusSchema }),
  asyncHandler(adminCategoriesController.updateCategoryStatus),
);

// 6. Delete category (safe check for destinations in use, supports ?reassignTo=<categoryId>)
router.delete(
  '/:id',
  validate({ params: idParamSchema, query: DeleteCategoryQuerySchema }),
  asyncHandler(adminCategoriesController.deleteCategory),
);

export const adminCategoryRoutes = router;
