import { Router } from 'express';
import { adminRecommendationsController } from './admin-recommendations.controller';
import { authenticateAdmin } from '../../../common/middleware/auth.middleware';
import { validate } from '../../../common/middleware/validate.middleware';
import { CreateAdminRecommendationSchema, UpdateAdminRecommendationSchema } from './dto/admin-recommendation.dto';
import { idParamSchema } from '../validation/admin-validation.schemas';
import { asyncHandler } from '../../../common/utils/async-handler.util';

const router = Router();

router.use(authenticateAdmin);

router.get('/', asyncHandler(adminRecommendationsController.getRecommendations));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(adminRecommendationsController.getRecommendationById));
router.post('/', validate({ body: CreateAdminRecommendationSchema }), asyncHandler(adminRecommendationsController.createRecommendation));
router.put('/:id', validate({ params: idParamSchema, body: UpdateAdminRecommendationSchema }), asyncHandler(adminRecommendationsController.updateRecommendation));
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler(adminRecommendationsController.deleteRecommendation));

export const adminRecommendationRoutes: Router = router;
