-- =====================================================================
-- Migration: 20260907171000_drop_obsolete_legacy_columns
-- Fix: Drop legacy columns from init_schema that are not in schema.prisma
-- and have NOT NULL constraints preventing record creation.
-- All statements are safe and idempotent.
-- =====================================================================

-- 1. destination_images: drop legacy url and isCover
ALTER TABLE "destination_images" DROP COLUMN IF EXISTS "url";
ALTER TABLE "destination_images" DROP COLUMN IF EXISTS "isCover";
UPDATE "destination_images" SET "imageUrl" = '' WHERE "imageUrl" IS NULL;
ALTER TABLE "destination_images" ALTER COLUMN "imageUrl" SET NOT NULL;

-- 2. itinerary_items: drop legacy columns
ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "durationMinutes";
ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "customPlaceName";
ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "activityDescription";
ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "transportType";
ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "note";

-- 3. accommodations: drop legacy columns
ALTER TABLE "accommodations" DROP COLUMN IF EXISTS "locationName";
ALTER TABLE "accommodations" DROP COLUMN IF EXISTS "contactEmail";
ALTER TABLE "accommodations" DROP COLUMN IF EXISTS "bookingUrl";

-- 4. restaurants: drop legacy columns
ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "locationName";
ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "contactPhone";
ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "averageCostPerPerson";

-- 5. travel_journals: drop legacy location
ALTER TABLE "travel_journals" DROP COLUMN IF EXISTS "location";

-- 6. recommendations: drop legacy description
ALTER TABLE "recommendations" DROP COLUMN IF EXISTS "description";

-- 7. checklists & checklist_items: drop legacy columns
ALTER TABLE "checklists" DROP COLUMN IF EXISTS "tripType";
ALTER TABLE "checklists" DROP COLUMN IF EXISTS "totalItems";
ALTER TABLE "checklists" DROP COLUMN IF EXISTS "completedItems";
ALTER TABLE "checklist_items" DROP COLUMN IF EXISTS "item";
ALTER TABLE "checklist_items" DROP COLUMN IF EXISTS "category";
ALTER TABLE "checklist_items" DROP COLUMN IF EXISTS "isCompleted";

-- 8. itineraries & itinerary_days: drop legacy columns
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "estimatedCost";
ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "isGenerated";
ALTER TABLE "itinerary_days" DROP COLUMN IF EXISTS "theme";
ALTER TABLE "itinerary_days" DROP COLUMN IF EXISTS "note";
