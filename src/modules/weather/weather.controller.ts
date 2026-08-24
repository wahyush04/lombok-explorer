import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { weatherService, WeatherService } from './weather.service';
import { WeatherQuery } from './dto/weather.dto';

export class WeatherController {
  constructor(private readonly service: WeatherService = weatherService) {}

  public getWeather = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as WeatherQuery;
    const data = await this.service.getWeather(query);
    return ResponseUtil.sendSuccess(res, data, 'Current weather data retrieved successfully');
  });
}

export const weatherController = new WeatherController();
