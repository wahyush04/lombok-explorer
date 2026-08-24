import { WeatherDataDto } from '../dto/weather.dto';

export interface IWeatherProvider {
  /**
   * Fetches the current weather data for the specified location query or coordinates.
   */
  getCurrentWeather(locationQuery: string): Promise<WeatherDataDto>;

  /**
   * Returns the unique identifier/name of the weather provider.
   */
  getProviderName(): string;
}
