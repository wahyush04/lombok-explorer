import { Router } from 'express';
import { adminAuthRoutes } from '../../modules/admin/auth/admin-auth.routes';
import { adminDashboardRoutes } from '../../modules/admin/dashboard/admin-dashboard.routes';

const router = Router();

// ==========================================
// ADMIN MODULE ROUTERS
// ==========================================

// 1. Admin Authentication (/api/v1/admin/auth/*)
router.use('/auth', adminAuthRoutes);

// 2. Admin Dashboard Statistics (/api/v1/admin/dashboard)
router.use('/dashboard', adminDashboardRoutes);

export const adminRoutes = router;
