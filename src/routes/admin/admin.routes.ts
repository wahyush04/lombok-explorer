import { Router } from 'express';
import { adminAuthRoutes } from '../../modules/admin/auth/admin-auth.routes';
import { adminDashboardRoutes } from '../../modules/admin/dashboard/admin-dashboard.routes';
import { adminDestinationRoutes } from '../../modules/admin/destinations/admin-destinations.routes';
import { adminCategoryRoutes } from '../../modules/admin/categories/admin-categories.routes';
import { adminRestaurantRoutes } from '../../modules/admin/restaurants/admin-restaurants.routes';
import { adminAccommodationRoutes } from '../../modules/admin/accommodations/admin-accommodations.routes';
import { adminUserRoutes } from '../../modules/admin/users/admin-users.routes';
import { adminReviewRoutes } from '../../modules/admin/reviews/admin-reviews.routes';
import { adminAuditLogRoutes } from '../../modules/admin/audit-logs/admin-audit-logs.routes';
import { adminFeedsRoutes } from '../../modules/admin/feeds/admin-feeds.routes';
import { adminItineraryTemplateRoutes } from '../../modules/admin/itinerary-templates/admin-itinerary-templates.routes';

const router = Router();

// ==========================================
// ADMIN MODULE ROUTERS
// ==========================================

// 1. Admin Authentication (/api/v1/admin/auth/*)
router.use('/auth', adminAuthRoutes);

// 2. Admin Dashboard Statistics (/api/v1/admin/dashboard)
router.use('/dashboard', adminDashboardRoutes);

// 3. Admin Destinations Management (/api/v1/admin/destinations)
router.use('/destinations', adminDestinationRoutes);

// 4. Admin Categories Management (/api/v1/admin/categories)
router.use('/categories', adminCategoryRoutes);

// 5. Admin Restaurants Management (/api/v1/admin/restaurants)
router.use('/restaurants', adminRestaurantRoutes);

// 6. Admin Accommodations Management (/api/v1/admin/accommodations)
router.use('/accommodations', adminAccommodationRoutes);

// 7. Admin User Management (/api/v1/admin/users)
router.use('/users', adminUserRoutes);

// 8. Admin Reviews Moderation (/api/v1/admin/reviews)
router.use('/reviews', adminReviewRoutes);

// 9. Admin Audit Logs (/api/v1/admin/audit-logs)
router.use('/audit-logs', adminAuditLogRoutes);

// 10. Admin Feeds & Social Moderation (/api/v1/admin/feeds)
router.use('/feeds', adminFeedsRoutes);

// 11. Admin Curated Itinerary Templates (/api/v1/admin/itinerary-templates)
router.use('/itinerary-templates', adminItineraryTemplateRoutes);

export const adminRoutes = router;
