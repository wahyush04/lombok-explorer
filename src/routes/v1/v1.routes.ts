import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';
import { authRoutes } from '../../modules/auth/auth.routes';
import { destinationRoutes } from '../../modules/destinations/destinations.routes';
import { categoryRoutes } from '../../modules/categories/categories.routes';
import { favoriteRoutes } from '../../modules/favorites/favorites.routes';
import { reviewRoutes } from '../../modules/reviews/reviews.routes';
import { itineraryRoutes } from '../../modules/itineraries/itineraries.routes';
import { itinerariesController } from '../../modules/itineraries/itineraries.controller';
import { recommendationRoutes } from '../../modules/recommendations/recommendations.routes';
import { weatherRoutes } from '../../modules/weather/weather.routes';
import { expenseRoutes } from '../../modules/expenses/expenses.routes';
import { journalRoutes } from '../../modules/journals/journals.routes';
import { checklistRoutes } from '../../modules/checklists/checklists.routes';
import { mediaRoutes, storageRoutes } from '../../modules/storage/storage.routes';
import { feedRoutes } from '../../modules/feeds';
import { userRoutes } from '../../modules/users/users.routes';
import { adminRoutes } from '../admin/admin.routes';

const router = Router();

// 1. Healthcheck & System Status
router.use('/health', healthRoutes);

// 2. Authentication & User Profile Module (Phase 7)
router.use('/auth', authRoutes);

// 3. Tourism Destinations Discovery (Phase 8)
router.use('/destinations', destinationRoutes);

// 4. Categories & Classification (Phase 8)
router.use('/categories', categoryRoutes);

// 5. User Favorites & Bookmarks (Phase 9)
router.use('/favorites', favoriteRoutes);

// 6. User Reviews & Ratings (Phase 10)
router.use('/reviews', reviewRoutes);

// 7. Itineraries & Smart Trip Planner Module (Phase 11)
router.use('/itineraries', itineraryRoutes);
router.get('/shared/itineraries/:shareToken', itinerariesController.getSharedItinerary);

// 8. Smart Recommendation Engine (Phase 15)
router.use('/recommendations', recommendationRoutes);

// 9. Weather Service Module (Phase 16)
router.use('/weather', weatherRoutes);

// 10. Expenses & Budgeting Module (Phase 17)
router.use('/expenses', expenseRoutes);

// 11. Travel Journals Module (Phase 18)
router.use('/journals', journalRoutes);

// 12. Packing Checklists Module (Phase 18)
router.use('/checklists', checklistRoutes);

// 13. Centralized Media & File Storage Module (Cloudinary Storage)
router.use('/media', mediaRoutes);
router.use('/storage', storageRoutes);


// 14. Feeds & Community Social Module
router.use('/feeds', feedRoutes);

// 15. User Management & Profile Resources
router.use('/users', userRoutes);

// 16. Dedicated Admin API Layer (Phase 28 / Admin Operations)
router.use('/admin', adminRoutes);

export const v1Routes: Router = router;
