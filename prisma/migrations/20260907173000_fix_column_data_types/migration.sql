-- =====================================================================
-- Migration: 20260907173000_fix_column_data_types
-- Fix: Align PostgreSQL column data types with Prisma schema types:
-- - reviews.rating: INTEGER -> DOUBLE PRECISION
-- - reviews.photos: TEXT[] -> TEXT (JSON string)
-- - travel_journals.photos: TEXT[] -> TEXT (JSON string)
-- - weather_cache.uvIndex: DOUBLE PRECISION -> INTEGER
-- =====================================================================

-- 1. reviews
ALTER TABLE "reviews" ALTER COLUMN "rating" TYPE DOUBLE PRECISION USING "rating"::double precision;
ALTER TABLE "reviews" ALTER COLUMN "photos" DROP DEFAULT;
ALTER TABLE "reviews" ALTER COLUMN "photos" TYPE TEXT USING CASE 
  WHEN "photos" IS NULL THEN NULL 
  ELSE array_to_json("photos")::text 
END;

-- 2. travel_journals
ALTER TABLE "travel_journals" ALTER COLUMN "photos" DROP DEFAULT;
ALTER TABLE "travel_journals" ALTER COLUMN "photos" TYPE TEXT USING CASE 
  WHEN "photos" IS NULL THEN NULL 
  ELSE array_to_json("photos")::text 
END;

-- 3. weather_cache
ALTER TABLE "weather_cache" ALTER COLUMN "uvIndex" TYPE INTEGER USING ROUND("uvIndex")::integer;
