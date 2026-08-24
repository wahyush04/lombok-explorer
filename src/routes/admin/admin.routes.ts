import { Router } from 'express';
import { adminAuthRoutes } from '../../modules/admin/auth/admin-auth.routes';

const router = Router();

// ==========================================
// ADMIN MODULE ROUTERS
// ==========================================

// 1. Admin Authentication (/api/v1/admin/auth/*)
router.use('/auth', adminAuthRoutes);

export const adminRoutes = router;
