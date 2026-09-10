-- AlterTable itinerary_days: Add startLocation
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "startLocation" TEXT;
