import { WeatherDataDto } from '../dto/weather.dto';
import { IWeatherProvider } from './weather-provider.interface';

export class MockWeatherProvider implements IWeatherProvider {
  public getProviderName(): string {
    return 'MockWeatherProvider';
  }

  public async getCurrentWeather(locationQuery: string): Promise<WeatherDataDto> {
    const loc = locationQuery.toLowerCase();
    const isBeachOrGili = loc.includes('gili') || loc.includes('kuta') || loc.includes('senggigi');

    return {
      location: {
        name: locationQuery || 'Mataram',
        region: 'West Nusa Tenggara',
        country: 'Indonesia',
        latitude: isBeachOrGili ? -8.892 : -8.5833,
        longitude: isBeachOrGili ? 116.295 : 116.1167,
        localTime: '2026-08-23 12:00',
        timezone: 'Asia/Makassar',
      },
      current: {
        temperatureC: isBeachOrGili ? 29.5 : 27.0,
        temperatureF: isBeachOrGili ? 85.1 : 80.6,
        feelsLikeC: isBeachOrGili ? 31.0 : 28.5,
        feelsLikeF: isBeachOrGili ? 87.8 : 83.3,
        isDay: true,
        condition: {
          text: isBeachOrGili ? 'Sunny & Clear' : 'Partly Cloudy',
          icon: 'https://cdn.weatherapi.com/weather/64x64/day/113.png',
          code: 1000,
        },
        humidity: 68,
        windKph: 18.5,
        windMph: 11.5,
        windDirection: 'ESE',
        uvIndex: 8,
        visibilityKm: 10,
        lastUpdated: '2026-08-23 12:00',
      },
    };
  }
}

export const mockWeatherProvider = new MockWeatherProvider();
