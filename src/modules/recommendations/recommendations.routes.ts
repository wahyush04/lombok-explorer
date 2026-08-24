import { Router } from 'express';
import { recommendationsController } from './recommendations.controller';
import { optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { RecommendationQuerySchema } from './dto/recommendation.dto';
import { expensiveAiLimiter } from '../../common/middleware/rate-limit.middleware';

const router = Router();

// GET /recommendations (Supports personalized and guest recommendations with heavy compute rate limiter)
router.get(
  '/',
  expensiveAiLimiter,
  optionalAuthenticate,
  validate({ query: RecommendationQuerySchema }),
  recommendationsController.getRecommendations,
);

export const recommendationRoutes: Router = router;
