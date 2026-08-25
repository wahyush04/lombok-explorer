import { Router } from 'express';
import { adminAuthRoutes } from '../../modules/admin/auth/admin-auth.routes';
import { adminDashboardRoutes } from '../../modules/admin/dashboard/admin-dashboard.routes';
import { adminDestinationRoutes } from '../../modules/admin/destinations/admin-destinations.routes';

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

export const adminRoutes = router;
