import { Router } from 'express';
import { v1Routes } from './v1/v1.routes';
import { v2Routes } from './v2/v2.routes';

const router = Router();

// =============================================================================
// API VERSIONING ARCHITECTURE (Phase 23)
// =============================================================================

// 1. Primary Canonical API v1: /api/v1/*
router.use('/api/v1', v1Routes);

// 2. Legacy / Backward-Compatible Alias: /v1/*
router.use('/v1', v1Routes);

// 3. API v2 Extensible Module: /api/v2/* and /v2/*
router.use('/api/v2', v2Routes);
router.use('/v2', v2Routes);

export { v1Routes, v2Routes };
export const apiRoutes: Router = router;
