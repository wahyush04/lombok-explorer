import { Router } from 'express';
import { weatherController } from './weather.controller';
import { validate } from '../../common/middleware/validate.middleware';
import { WeatherQuerySchema } from './dto/weather.dto';

const router = Router();

// GET /weather (Public weather endpoint with query validation)
router.get('/', validate({ query: WeatherQuerySchema }), weatherController.getWeather);

export const weatherRoutes: Router = router;
