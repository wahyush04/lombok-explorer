-- =====================================================================
-- Migration: 20260907174000_make_itinerary_dates_optional
-- Fix: Make startDate, endDate, date, startTime, and endTime nullable
-- as defined in schema.prisma and required by itinerary creation.
-- =====================================================================

ALTER TABLE "itineraries" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "itineraries" ALTER COLUMN "endDate" DROP NOT NULL;
ALTER TABLE "itinerary_days" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "itinerary_items" ALTER COLUMN "startTime" DROP NOT NULL;
ALTER TABLE "itinerary_items" ALTER COLUMN "endTime" DROP NOT NULL;
