-- =====================================================================
-- Migration: 20260907170000_sync_all_remaining_schema
-- Fix: Reconcile all remaining schema drift between schema.prisma and PostgreSQL.
-- Covers: destination_images, reviews, itineraries, itinerary_days,
--         travel_journals, checklists, checklist_items, weather_cache, post_media.
-- All statements are safe and idempotent.
-- =====================================================================

-- 1. destination_images: sync to current Prisma schema
ALTER TABLE "destination_images" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "destination_images" ADD COLUMN IF NOT EXISTS "imagePublicId" TEXT;
ALTER TABLE "destination_images" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destination_images' AND column_name = 'url') THEN
    UPDATE "destination_images" SET "imageUrl" = "url" WHERE "imageUrl" IS NULL AND "url" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destination_images' AND column_name = 'isCover') THEN
    UPDATE "destination_images" SET "isPrimary" = "isCover" WHERE "isCover" IS NOT NULL;
  END IF;
END $$;

-- 2. reviews: add deletedAt for soft delete
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 3. itineraries: sync columns to current Prisma schema
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "totalEstimatedBudget" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "pace" TEXT NOT NULL DEFAULT 'BALANCED';
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itineraries' AND column_name = 'estimatedCost') THEN
    UPDATE "itineraries" SET "totalEstimatedBudget" = "estimatedCost" WHERE "totalEstimatedBudget" = 0 AND "estimatedCost" IS NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "itineraries_shareToken_key" ON "itineraries"("shareToken");

-- 4. itinerary_days: title and notes
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "notes" TEXT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_days' AND column_name = 'theme') THEN
    UPDATE "itinerary_days" SET "title" = "theme" WHERE "title" = '' AND "theme" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'itinerary_days' AND column_name = 'note') THEN
    UPDATE "itinerary_days" SET "notes" = "note" WHERE "notes" IS NULL AND "note" IS NOT NULL;
  END IF;
END $$;

-- 5. travel_journals: locationName
ALTER TABLE "travel_journals" ADD COLUMN IF NOT EXISTS "locationName" TEXT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_journals' AND column_name = 'location') THEN
    UPDATE "travel_journals" SET "locationName" = "location" WHERE "locationName" IS NULL AND "location" IS NOT NULL;
  END IF;
END $$;

-- 6. checklists & checklist_items: category, itemText, isChecked
ALTER TABLE "checklists" ADD COLUMN IF NOT EXISTS "category" "ChecklistCategory" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "itemText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "isChecked" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'item') THEN
    UPDATE "checklist_items" SET "itemText" = "item" WHERE "itemText" = '' AND "item" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'isCompleted') THEN
    UPDATE "checklist_items" SET "isChecked" = "isCompleted" WHERE "isCompleted" IS NOT NULL;
  END IF;
END $$;

-- 7. weather_cache: createdAt and updatedAt
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "weather_cache" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. post_media: imageUrl, publicId, width, height, format, orderIndex
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "format" TEXT;
ALTER TABLE "post_media" ADD COLUMN IF NOT EXISTS "orderIndex" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_media' AND column_name = 'url') THEN
    UPDATE "post_media" SET "imageUrl" = "url" WHERE "imageUrl" IS NULL AND "url" IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_media' AND column_name = 'sortOrder') THEN
    UPDATE "post_media" SET "orderIndex" = "sortOrder" WHERE "orderIndex" = 0 AND "sortOrder" IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "post_media_postId_orderIndex_idx" ON "post_media"("postId", "orderIndex");
