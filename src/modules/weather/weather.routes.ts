import { Router } from 'express';
import { weatherController } from './weather.controller';
import { validate } from '../../common/middleware/validate.middleware';
import { WeatherQuerySchema } from './dto/weather.dto';

const router = Router();

// GET /weather and GET /weather/current (Public weather endpoints)
router.get('/', validate({ query: WeatherQuerySchema }), weatherController.getWeather);
router.get('/current', validate({ query: WeatherQuerySchema }), weatherController.getWeather);

export const weatherRoutes: Router = router;
