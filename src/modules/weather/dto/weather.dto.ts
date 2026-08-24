import { z } from 'zod';
import { LombokRegion } from '@prisma/client';

export const WeatherQuerySchema = z.object({
  q: z.string().trim().optional(),
  location: z.string().trim().optional(),
  city: z.string().trim().optional(),
  region: z.nativeEnum(LombokRegion).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export type WeatherQuery = z.infer<typeof WeatherQuerySchema>;

export interface WeatherLocationDto {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  localTime: string;
  timezone?: string;
}

export interface CurrentWeatherConditionDto {
  text: string;
  icon: string;
  code: number;
}

export interface CurrentWeatherDto {
  temperatureC: number;
  temperatureF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  isDay: boolean;
  condition: CurrentWeatherConditionDto;
  humidity: number;
  windKph: number;
  windMph: number;
  windDirection: string;
  uvIndex: number;
  visibilityKm?: number;
  lastUpdated: string;
}

export interface WeatherDataDto {
  location: WeatherLocationDto;
  current: CurrentWeatherDto;
}

export interface WeatherResponseDto {
  location: WeatherLocationDto;
  current: CurrentWeatherDto;
  meta: {
    provider: string;
    cached: boolean;
    cachedAt?: string;
    expiresAt?: string;
  };
}
