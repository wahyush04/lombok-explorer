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

export interface DirectionsLegResult {
  fromActivityId: string | null;
  toActivityId: string;
  legOrder: number;
  distanceMeters: number;
  durationSeconds: number;
  geometry: string; // Encoded Polyline6
}

export interface DirectionsRouteResult {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  geometry: string; // Full Encoded Polyline6
  legs: DirectionsLegResult[];
}

export interface IMapboxDirectionsService {
  getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode?: TransportationMode,
  ): Promise<{ distanceMeters: number; durationSeconds: number; geometry: string }>;
  getRouteForLeg(
    fromActivityId: string | null,
    toActivityId: string,
    fromCoord: { latitude: number; longitude: number },
    toCoord: { latitude: number; longitude: number },
    legOrder?: number,
    mode?: TransportationMode,
  ): Promise<DirectionsLegResult>;
  getRoutesForActivities(
    coordinates: GeoCoordinate[],
    mode?: TransportationMode,
  ): Promise<DirectionsRouteResult>;
}

