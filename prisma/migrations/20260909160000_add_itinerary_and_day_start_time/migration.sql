-- AlterTable itineraries: Add startTime
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "startTime" TEXT;

-- AlterTable itinerary_days: Add startTime
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
