-- =====================================================================
-- Migration: 20260907172000_unify_destination_status_enum
-- Fix: Unify catalog entity status columns (categories, restaurants, accommodations)
-- to use the unified DestinationStatus enum ('PUBLISHED', 'DRAFT', 'ARCHIVED')
-- matching the Prisma schema and application TypeScript models.
-- =====================================================================

-- 1. categories: convert status from CategoryStatus to DestinationStatus
ALTER TABLE "categories" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "categories" ALTER COLUMN "status" TYPE "DestinationStatus" USING "status"::text::"DestinationStatus";
ALTER TABLE "categories" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"DestinationStatus";

-- 2. restaurants: convert status from RestaurantStatus to DestinationStatus
ALTER TABLE "restaurants" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "restaurants" ALTER COLUMN "status" TYPE "DestinationStatus" USING "status"::text::"DestinationStatus";
ALTER TABLE "restaurants" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"DestinationStatus";

-- 3. accommodations: convert status from AccommodationStatus to DestinationStatus
ALTER TABLE "accommodations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "accommodations" ALTER COLUMN "status" TYPE "DestinationStatus" USING "status"::text::"DestinationStatus";
ALTER TABLE "accommodations" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"DestinationStatus";

-- 4. Drop obsolete enum types
DROP TYPE IF EXISTS "CategoryStatus";
DROP TYPE IF EXISTS "RestaurantStatus";
DROP TYPE IF EXISTS "AccommodationStatus";
