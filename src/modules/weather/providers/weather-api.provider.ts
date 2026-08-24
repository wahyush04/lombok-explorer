import { config } from '../../../config/config';
import { AppError, NotFoundError } from '../../../common/errors/app-error';
import { HttpStatus } from '../../../common/constants';
import { WeatherDataDto } from '../dto/weather.dto';
import { IWeatherProvider } from './weather-provider.interface';
import { logger } from '../../../common/utils/logger';

interface WeatherApiRawResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime: string;
  };
  current: {
    last_updated: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    wind_dir: string;
    humidity: number;
    feelslike_c: number;
    feelslike_f: number;
    vis_km?: number;
    uv: number;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class WeatherApiProvider implements IWeatherProvider {
  constructor(
    private readonly apiKey: string = config.weather.apiKey,
    private readonly baseUrl: string = config.weather.baseUrl,
  ) {}

  public getProviderName(): string {
    return 'WeatherAPI';
  }

  private normalizeIconUrl(icon: string): string {
    if (!icon) return '';
    if (icon.startsWith('//')) {
      return `https:${icon}`;
    }
    return icon;
  }

  public async getCurrentWeather(locationQuery: string): Promise<WeatherDataDto> {
    const cleanQuery = encodeURIComponent(locationQuery.trim());
    const requestUrl = `${this.baseUrl}/current.json?q=${cleanQuery}&key=${this.apiKey}`;

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      const data = (await response.json()) as WeatherApiRawResponse;

      if (!response.ok || data.error) {
        if (response.status === 400 || data.error?.code === 1006) {
          throw new NotFoundError(
            `Weather location '${locationQuery}' not found`,
            'WEATHER_LOCATION_NOT_FOUND',
          );
        }

        logger.error({ status: response.status, error: data.error }, 'WeatherAPI request failed');
        throw new AppError(
          data.error?.message || 'Failed to fetch weather data from upstream provider',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'WEATHER_PROVIDER_ERROR',
        );
      }

      return {
        location: {
          name: data.location.name,
          region: data.location.region,
          country: data.location.country,
          latitude: data.location.lat,
          longitude: data.location.lon,
          localTime: data.location.localtime,
          timezone: data.location.tz_id,
        },
        current: {
          temperatureC: data.current.temp_c,
          temperatureF: data.current.temp_f,
          feelsLikeC: data.current.feelslike_c,
          feelsLikeF: data.current.feelslike_f,
          isDay: data.current.is_day === 1,
          condition: {
            text: data.current.condition.text,
            icon: this.normalizeIconUrl(data.current.condition.icon),
            code: data.current.condition.code,
          },
          humidity: data.current.humidity,
          windKph: data.current.wind_kph,
          windMph: data.current.wind_mph,
          windDirection: data.current.wind_dir,
          uvIndex: data.current.uv,
          visibilityKm: data.current.vis_km,
          lastUpdated: data.current.last_updated,
        },
      };
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }
      logger.error({ err }, 'Network or unexpected error while fetching weather data');
      throw new AppError(
        'Unable to communicate with Weather API provider',
        HttpStatus.SERVICE_UNAVAILABLE,
        'WEATHER_GATEWAY_ERROR',
      );
    }
  }
}

export const weatherApiProvider = new WeatherApiProvider();
