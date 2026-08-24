import { LombokRegion } from '@prisma/client';
import { config } from '../../config/config';
import { WeatherDataDto, WeatherQuery, WeatherResponseDto } from './dto/weather.dto';
import { IWeatherProvider, weatherApiProvider } from './providers';

interface CacheEntry {
  data: WeatherDataDto;
  cachedAt: Date;
  expiresAt: Date;
}

export class WeatherService {
  private provider: IWeatherProvider;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  constructor(provider: IWeatherProvider = weatherApiProvider) {
    this.provider = provider;
    this.cacheTtlMs = (config.weather.cacheTtlSeconds || 600) * 1000;
  }

  /**
   * Allows hot-swapping weather data provider (e.g. WeatherAPI, OpenWeather, MockWeather).
   */
  public setProvider(provider: IWeatherProvider): void {
    this.provider = provider;
  }

  public getActiveProviderName(): string {
    return this.provider.getProviderName();
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private resolveLocationQuery(query: WeatherQuery): string {
    if (query.q) return query.q.trim();
    if (query.location) return query.location.trim();
    if (query.city) return query.city.trim();

    const lat = query.lat ?? query.latitude;
    const lng = query.lng ?? query.longitude;
    if (lat !== undefined && lng !== undefined) {
      return `${lat},${lng}`;
    }

    if (query.region) {
      switch (query.region) {
        case LombokRegion.LOMBOK_SELATAN:
          return 'Kuta, Lombok';
        case LombokRegion.LOMBOK_UTARA:
          return 'Senaru, Lombok';
        case LombokRegion.LOMBOK_BARAT:
          return 'Senggigi, Lombok';
        case LombokRegion.LOMBOK_TIMUR:
          return 'Sembalun, Lombok';
        case LombokRegion.LOMBOK_TENGAH:
          return 'Praya, Lombok';
        case LombokRegion.GILI_ISLANDS:
          return 'Gili Trawangan';
        default:
          return 'Mataram, Lombok';
      }
    }

    return 'Mataram, Lombok';
  }

  public async getWeather(query: WeatherQuery): Promise<WeatherResponseDto> {
    const locationQuery = this.resolveLocationQuery(query);
    const cacheKey = `${this.provider.getProviderName()}:${locationQuery.toLowerCase()}`;
    const now = new Date();

    // 1. Check in-memory cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return {
        location: cached.data.location,
        current: cached.data.current,
        meta: {
          provider: this.provider.getProviderName(),
          cached: true,
          cachedAt: cached.cachedAt.toISOString(),
          expiresAt: cached.expiresAt.toISOString(),
        },
      };
    }

    // 2. Fetch fresh weather data from active provider
    const weatherData = await this.provider.getCurrentWeather(locationQuery);

    // 3. Save to cache
    const expiresAt = new Date(now.getTime() + this.cacheTtlMs);
    this.cache.set(cacheKey, {
      data: weatherData,
      cachedAt: now,
      expiresAt,
    });

    return {
      location: weatherData.location,
      current: weatherData.current,
      meta: {
        provider: this.provider.getProviderName(),
        cached: false,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}

export const weatherService = new WeatherService();
