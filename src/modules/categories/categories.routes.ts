import { Router } from 'express';
import { categoriesController } from './categories.controller';
import { validate } from '../../common/middleware/validate.middleware';
import { CategoryDestinationsQuerySchema } from './dto/category.dto';

const router = Router();

// 1. Get all categories
router.get('/', categoriesController.getCategories);

// 2. Get category destinations: /categories/:id/destinations (must precede or be explicitly matched)
router.get(
  '/:id/destinations',
  validate({ query: CategoryDestinationsQuerySchema }),
  categoriesController.getCategoryDestinations,
);

// 3. Get category detail by ID or Slug
router.get('/:id', categoriesController.getByIdOrSlug);

export const categoryRoutes: Router = router;
