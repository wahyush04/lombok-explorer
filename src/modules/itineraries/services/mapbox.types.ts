import { TransportationMode } from '@prisma/client';

export interface GeoCoordinate {
  id?: string;
  name?: string;
  latitude: number;
  longitude: number;
}

export interface MatrixResult {
  distancesKm: number[][]; // distance in kilometers
  durationsMinutes: number[][]; // duration in minutes
}

export interface RouteSegmentResult {
  fromActivityId?: string;
  toActivityId?: string;
  distanceKm: number;
  travelTimeMinutes: number;
}

export interface OptimizationResult {
  orderedIndices: number[]; // Ordered sequence of indices matching input coordinates
  totalDistanceKm: number;
  totalDurationMinutes: number;
  segments: RouteSegmentResult[];
}

export interface IMapboxMatrixService {
  calculateMatrix(coordinates: GeoCoordinate[], mode?: TransportationMode): Promise<MatrixResult>;
}

export interface IMapboxOptimizationService {
  optimizeRoute(
    coordinates: GeoCoordinate[],
    mode?: TransportationMode,
    fixedStartIndex?: number,
    fixedEndIndex?: number,
  ): Promise<OptimizationResult>;
}
