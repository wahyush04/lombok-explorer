-- =====================================================================
-- Migration: 20260907160000_add_missing_columns
-- Fix: Add all columns that are in Prisma schema but missing from prior
-- migration DDL. All statements use IF NOT EXISTS for idempotency.
-- =====================================================================

-- 1. categories: coverImagePublicId (missing from init_schema CREATE TABLE)
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "coverImagePublicId" TEXT;

-- 2. recommendations: sync to current Prisma schema
-- Old migration had: id, title, description, travelStyle, budgetLevel, matchScore, reasoning, createdAt
-- Schema now has: id, title, subtitle, bannerUrl, bannerPublicId, travelStyle, budgetLevel, recommendedDays, estimatedBudget, isActive, createdAt, updatedAt
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "subtitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "bannerPublicId" TEXT;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "recommendedDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "estimatedBudget" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Remove stale columns (old API no longer in Prisma schema)
ALTER TABLE "recommendations" DROP COLUMN IF EXISTS "matchScore";
ALTER TABLE "recommendations" DROP COLUMN IF EXISTS "reasoning";
-- The old 'description' column is gone from schema too (replaced by subtitle + bannerUrl pattern)
-- Keep 'description' as nullable to avoid data loss, but the Prisma model no longer uses it
-- (No action needed - extra columns don't break Prisma reads unless they're in the model)

-- 3. weather_cache: sync to current Prisma schema
-- Old migration had: id, region, temperature, condition, description, humidity, windSpeed, uvIndex, forecast(JSONB), cachedAt, expiresAt
-- Schema now has: id, region(unique), locationName, condition, tempCelsius, feelsLikeCelsius, humidityPercent, windSpeedKmh, uvIndex, iconName, recommendationTip, forecast(TEXT), lastUpdated, createdAt, updatedAt
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "locationName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "tempCelsius" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "feelsLikeCelsius" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "humidityPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "windSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "iconName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "recommendationTip" TEXT NOT NULL DEFAULT '';
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Convert forecast from JSONB to TEXT if it is still JSONB
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weather_cache' AND column_name = 'forecast' AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE "weather_cache" ALTER COLUMN "forecast" TYPE TEXT USING "forecast"::text;
  END IF;
END $$;
-- Migrate data from legacy columns to new columns before dropping
UPDATE "weather_cache" SET
  "tempCelsius" = COALESCE(CAST("temperature" AS INTEGER), 0),
  "humidityPercent" = COALESCE("humidity", 0),
  "windSpeedKmh" = COALESCE("windSpeed", 0)
WHERE "tempCelsius" = 0;
-- Drop old columns no longer in schema
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "temperature";
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "description";
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "humidity";
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "windSpeed";
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "cachedAt";
ALTER TABLE "weather_cache" DROP COLUMN IF EXISTS "expiresAt";
