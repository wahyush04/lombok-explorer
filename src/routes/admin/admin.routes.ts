import { Router } from 'express';
import { adminAuthRoutes } from '../../modules/admin/auth/admin-auth.routes';
import { adminDashboardRoutes } from '../../modules/admin/dashboard/admin-dashboard.routes';
import { adminDestinationRoutes } from '../../modules/admin/destinations/admin-destinations.routes';
import { adminCategoryRoutes } from '../../modules/admin/categories/admin-categories.routes';
import { adminRestaurantRoutes } from '../../modules/admin/restaurants/admin-restaurants.routes';

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

export const adminRoutes = router;
