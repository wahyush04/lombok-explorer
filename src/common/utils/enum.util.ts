import { z } from 'zod';
import {
  BudgetLevel,
  DifficultyLevel,
  LombokRegion,
  TransportationMode,
  TravelStyle,
} from '@prisma/client';

/**
 * Normalizes travel style inputs from diverse frontend/android sources.
 * Supports lowercase, snake_case, kebab-case, spaces, and shortened aliases.
 */
export function normalizeTravelStyle(val: unknown): TravelStyle | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean === 'BEACH' || clean === 'BEACH_RELAXATION' || clean.includes('BEACH')) {
    return TravelStyle.BEACH_RELAXATION;
  }
  if (
    clean === 'NATURE' ||
    clean === 'ADVENTURE' ||
    clean === 'NATURE_ADVENTURE' ||
    clean.includes('NATURE') ||
    clean.includes('ADVENTURE')
  ) {
    return TravelStyle.NATURE_ADVENTURE;
  }
  if (
    clean === 'CULTURE' ||
    clean === 'HERITAGE' ||
    clean === 'CULTURE_HERITAGE' ||
    clean.includes('CULTURE') ||
    clean.includes('HERITAGE')
  ) {
    return TravelStyle.CULTURE_HERITAGE;
  }
  if (
    clean === 'CULINARY' ||
    clean === 'FOOD' ||
    clean === 'CULINARY_EXPLORER' ||
    clean.includes('CULINARY') ||
    clean.includes('FOOD')
  ) {
    return TravelStyle.CULINARY_EXPLORER;
  }
  if (
    clean === 'PHOTOGRAPHY' ||
    clean === 'PHOTO' ||
    clean === 'PHOTOGRAPHY_SPOTS' ||
    clean.includes('PHOTO')
  ) {
    return TravelStyle.PHOTOGRAPHY_SPOTS;
  }
  if (clean === 'FAMILY' || clean === 'FAMILY_FRIENDLY' || clean.includes('FAMILY')) {
    return TravelStyle.FAMILY_FRIENDLY;
  }

  // Direct enum match check
  if (Object.values(TravelStyle).includes(clean as TravelStyle)) {
    return clean as TravelStyle;
  }

  return undefined;
}

/**
 * Normalizes budget level inputs from diverse frontend/android sources.
 */
export function normalizeBudgetLevel(val: unknown): BudgetLevel | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean === 'BUDGET' || clean === 'LOW' || clean === 'CHEAP' || clean === 'HEMAT') {
    return BudgetLevel.BUDGET;
  }
  if (
    clean === 'MID' ||
    clean === 'MID_RANGE' ||
    clean === 'MEDIUM' ||
    clean === 'STANDARD' ||
    clean === 'SEDANG'
  ) {
    return BudgetLevel.MID_RANGE;
  }
  if (
    clean === 'LUXURY' ||
    clean === 'HIGH' ||
    clean === 'EXPENSIVE' ||
    clean === 'PREMIUM' ||
    clean === 'MEWAH'
  ) {
    return BudgetLevel.LUXURY;
  }

  if (Object.values(BudgetLevel).includes(clean as BudgetLevel)) {
    return clean as BudgetLevel;
  }

  return undefined;
}

/**
 * Normalizes transportation mode inputs.
 */
export function normalizeTransportationMode(val: unknown): TransportationMode | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean === 'CAR' || clean === 'MOBIL' || clean === 'TAXI') {
    return TransportationMode.CAR;
  }
  if (clean === 'MOTORCYCLE' || clean === 'MOTOR' || clean === 'SCOOTER' || clean === 'BIKE') {
    return TransportationMode.MOTORCYCLE;
  }
  if (clean === 'WALKING' || clean === 'WALK' || clean === 'JALAN_KAKI') {
    return TransportationMode.WALKING;
  }
  if (clean === 'CYCLING' || clean === 'BICYCLE' || clean === 'SEPEDA') {
    return TransportationMode.CYCLING;
  }
  if (
    clean === 'PUBLIC_TRANSPORT' ||
    clean === 'PUBLIC' ||
    clean === 'BUS' ||
    clean === 'ANGKUTAN'
  ) {
    return TransportationMode.PUBLIC_TRANSPORT;
  }

  if (Object.values(TransportationMode).includes(clean as TransportationMode)) {
    return clean as TransportationMode;
  }

  return undefined;
}

/**
 * Normalizes Lombok Region enum values.
 */
export function normalizeLombokRegion(val: unknown): LombokRegion | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean === 'LOMBOK_SELATAN' || clean === 'SELATAN' || clean === 'SOUTH') {
    return LombokRegion.LOMBOK_SELATAN;
  }
  if (clean === 'LOMBOK_UTARA' || clean === 'UTARA' || clean === 'NORTH') {
    return LombokRegion.LOMBOK_UTARA;
  }
  if (clean === 'LOMBOK_BARAT' || clean === 'BARAT' || clean === 'WEST') {
    return LombokRegion.LOMBOK_BARAT;
  }
  if (clean === 'LOMBOK_TIMUR' || clean === 'TIMUR' || clean === 'EAST') {
    return LombokRegion.LOMBOK_TIMUR;
  }
  if (clean === 'LOMBOK_TENGAH' || clean === 'TENGAH' || clean === 'CENTRAL') {
    return LombokRegion.LOMBOK_TENGAH;
  }
  if (clean === 'GILI_ISLANDS' || clean === 'GILI' || clean === 'GILIS') {
    return LombokRegion.GILI_ISLANDS;
  }

  if (Object.values(LombokRegion).includes(clean as LombokRegion)) {
    return clean as LombokRegion;
  }

  return undefined;
}

/**
 * Normalizes Difficulty Level enum values.
 */
export function normalizeDifficultyLevel(val: unknown): DifficultyLevel | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const clean = val.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean === 'EASY' || clean === 'MUDAH' || clean === 'RINGAN') {
    return DifficultyLevel.EASY;
  }
  if (clean === 'MODERATE' || clean === 'SEDANG' || clean === 'MENENGAH') {
    return DifficultyLevel.MODERATE;
  }
  if (clean === 'CHALLENGING' || clean === 'SULIT' || clean === 'MENANTANG') {
    return DifficultyLevel.CHALLENGING;
  }
  if (clean === 'EXTREME' || clean === 'EKSTREM' || clean === 'BERBAHAYA') {
    return DifficultyLevel.EXTREME;
  }

  if (Object.values(DifficultyLevel).includes(clean as DifficultyLevel)) {
    return clean as DifficultyLevel;
  }

  return undefined;
}

// Zod Preprocessed Schema Helpers
export const ZodTravelStyleSchema = z.preprocess(
  normalizeTravelStyle,
  z.nativeEnum(TravelStyle).optional(),
);

export const ZodBudgetLevelSchema = z.preprocess(
  normalizeBudgetLevel,
  z.nativeEnum(BudgetLevel).optional(),
);

export const ZodTransportationModeSchema = z.preprocess(
  normalizeTransportationMode,
  z.nativeEnum(TransportationMode).optional(),
);

export const ZodLombokRegionSchema = z.preprocess(
  normalizeLombokRegion,
  z.nativeEnum(LombokRegion).optional(),
);

export const ZodDifficultyLevelSchema = z.preprocess(
  normalizeDifficultyLevel,
  z.nativeEnum(DifficultyLevel).optional(),
);
