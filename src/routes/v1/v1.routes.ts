import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';
import { authRoutes } from '../../modules/auth/auth.routes';
import { destinationRoutes } from '../../modules/destinations/destinations.routes';
import { categoryRoutes } from '../../modules/categories/categories.routes';
import { favoriteRoutes } from '../../modules/favorites/favorites.routes';
import { reviewRoutes } from '../../modules/reviews/reviews.routes';
import { itineraryRoutes } from '../../modules/itineraries/itineraries.routes';
import { recommendationRoutes } from '../../modules/recommendations/recommendations.routes';
import { weatherRoutes } from '../../modules/weather/weather.routes';
import { expenseRoutes } from '../../modules/expenses/expenses.routes';
import { journalRoutes } from '../../modules/journals/journals.routes';
import { checklistRoutes } from '../../modules/checklists/checklists.routes';
import { storageRoutes } from '../../modules/storage/storage.routes';

const router = Router();

// 1. Healthcheck & System Status
router.use('/health', healthRoutes);

// 2. Authentication & User Profile Module (Phase 7)
router.use('/auth', authRoutes);

// 3. Destinations Module (Phase 8)
router.use('/destinations', destinationRoutes);

// 4. Categories Module (Phase 9)
router.use('/categories', categoryRoutes);

// 5. Favorites Module (Phase 10)
router.use('/favorites', favoriteRoutes);

// 6. Reviews Module (Phase 11)
router.use('/reviews', reviewRoutes);

// 7. Itineraries & Smart Generator Module (Phase 13 & 14)
router.use('/itineraries', itineraryRoutes);

// 8. Recommendation Engine (Phase 15)
router.use('/recommendations', recommendationRoutes);

// 9. Weather Service Module (Phase 16)
router.use('/weather', weatherRoutes);

// 10. Expenses & Budgeting Module (Phase 17)
router.use('/expenses', expenseRoutes);

// 11. Travel Journals Module (Phase 18)
router.use('/journals', journalRoutes);

// 12. Packing Checklists Module (Phase 18)
router.use('/checklists', checklistRoutes);

// 13. Image & File Storage Module (Phase 19)
router.use('/storage', storageRoutes);

export const v1Routes: Router = router;
