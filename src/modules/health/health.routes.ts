import { Router } from 'express';
import { HealthController } from './health.controller';
import { asyncHandler } from '../../common/utils/async-handler.util';

const router = Router();

// Detailed health status (metrics, memory, database, uptime)
router.get('/', asyncHandler(HealthController.getHealth));

// Readiness probe: verifies downstream DB connection readiness
router.get('/ready', asyncHandler(HealthController.getReadiness));

// Liveness probe: returns immediate alive response
router.get('/live', HealthController.getLiveness);

export const healthRoutes = router;
