-- Ensure Enums exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItineraryItemType') THEN
        CREATE TYPE "ItineraryItemType" AS ENUM ('DESTINATION', 'RESTAURANT', 'ACCOMMODATION', 'CUSTOM');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransportationMode') THEN
        CREATE TYPE "TransportationMode" AS ENUM ('CAR', 'MOTORCYCLE', 'WALKING', 'CYCLING', 'PUBLIC_TRANSPORT');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TravelStyle') THEN
        CREATE TYPE "TravelStyle" AS ENUM ('NATURE_ADVENTURE', 'BEACH_RELAXATION', 'CULTURE_HERITAGE', 'CULINARY_EXPLORER', 'PHOTOGRAPHY_SPOTS', 'FAMILY_FRIENDLY');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BudgetLevel') THEN
        CREATE TYPE "BudgetLevel" AS ENUM ('BUDGET', 'MID_RANGE', 'LUXURY');
    END IF;
END $$;

-- CreateTable itinerary_templates
CREATE TABLE IF NOT EXISTS "itinerary_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "totalDays" INTEGER NOT NULL DEFAULT 1,
    "travelStyle" "TravelStyle" NOT NULL DEFAULT 'BEACH_RELAXATION',
    "budgetLevel" "BudgetLevel" NOT NULL DEFAULT 'MID_RANGE',
    "transportationMode" "TransportationMode" NOT NULL DEFAULT 'CAR',
    "transportPaceNote" TEXT,
    "totalEstimatedBudget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "itinerary_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable template_days
CREATE TABLE IF NOT EXISTS "template_days" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "estimatedBudget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "template_days_templateId_dayNumber_key" UNIQUE ("templateId", "dayNumber")
);

-- CreateTable template_activities
CREATE TABLE IF NOT EXISTS "template_activities" (
    "id" TEXT NOT NULL,
    "templateDayId" TEXT NOT NULL,
    "itemType" "ItineraryItemType" NOT NULL DEFAULT 'DESTINATION',
    "destinationId" TEXT,
    "restaurantId" TEXT,
    "accommodationId" TEXT,
    "customLocation" TEXT,
    "customTitle" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "activityNotes" TEXT,
    "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "distanceFromPrevKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "travelTimeFromPrevMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_activities_pkey" PRIMARY KEY ("id")
);

-- Ensure updated columns on itineraries
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "coverImagePublicId" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "transportationMode" "TransportationMode" NOT NULL DEFAULT 'CAR';
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "startLocation" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "endLocation" TEXT;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "totalTravelTimeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "isSaved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "itineraries" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

-- Ensure updated columns on itinerary_days
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "totalDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "totalTravelTimeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "estimatedBudget" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Ensure updated columns on itinerary_items
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "itemType" "ItineraryItemType" NOT NULL DEFAULT 'DESTINATION';
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "accommodationId" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "customLocation" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "customTitle" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "timeSlot" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "activityNotes" TEXT;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "distanceFromPrevKm" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "travelTimeFromPrevMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Ensure updated columns on destinations, accommodations, restaurants
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "coverImagePublicId" TEXT;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "facilities" TEXT;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "tips" TEXT;

ALTER TABLE "accommodations" ADD COLUMN IF NOT EXISTS "coverImagePublicId" TEXT;
ALTER TABLE "accommodations" ADD COLUMN IF NOT EXISTS "images" TEXT;
ALTER TABLE "accommodations" ADD COLUMN IF NOT EXISTS "amenities" TEXT;
ALTER TABLE "accommodations" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;

ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "coverImagePublicId" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "images" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "minPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "maxPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "isHalalCertified" BOOLEAN NOT NULL DEFAULT true;

-- Indexes
CREATE INDEX IF NOT EXISTS "itinerary_templates_isPublished_idx" ON "itinerary_templates"("isPublished");
CREATE INDEX IF NOT EXISTS "itinerary_templates_isFeatured_sortOrder_idx" ON "itinerary_templates"("isFeatured", "sortOrder");
CREATE INDEX IF NOT EXISTS "itinerary_templates_travelStyle_idx" ON "itinerary_templates"("travelStyle");
CREATE INDEX IF NOT EXISTS "itinerary_templates_totalDays_idx" ON "itinerary_templates"("totalDays");

CREATE INDEX IF NOT EXISTS "template_days_templateId_idx" ON "template_days"("templateId");
CREATE INDEX IF NOT EXISTS "template_activities_templateDayId_idx" ON "template_activities"("templateDayId");
CREATE INDEX IF NOT EXISTS "template_activities_destinationId_idx" ON "template_activities"("destinationId");
CREATE INDEX IF NOT EXISTS "template_activities_restaurantId_idx" ON "template_activities"("restaurantId");
CREATE INDEX IF NOT EXISTS "template_activities_accommodationId_idx" ON "template_activities"("accommodationId");
CREATE INDEX IF NOT EXISTS "template_activities_orderIndex_idx" ON "template_activities"("orderIndex");

CREATE INDEX IF NOT EXISTS "itineraries_templateId_idx" ON "itineraries"("templateId");
CREATE INDEX IF NOT EXISTS "itinerary_items_restaurantId_idx" ON "itinerary_items"("restaurantId");
CREATE INDEX IF NOT EXISTS "itinerary_items_accommodationId_idx" ON "itinerary_items"("accommodationId");

-- Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_days_templateId_fkey') THEN
        ALTER TABLE "template_days" ADD CONSTRAINT "template_days_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "itinerary_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_activities_templateDayId_fkey') THEN
        ALTER TABLE "template_activities" ADD CONSTRAINT "template_activities_templateDayId_fkey" FOREIGN KEY ("templateDayId") REFERENCES "template_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_activities_destinationId_fkey') THEN
        ALTER TABLE "template_activities" ADD CONSTRAINT "template_activities_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_activities_restaurantId_fkey') THEN
        ALTER TABLE "template_activities" ADD CONSTRAINT "template_activities_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_activities_accommodationId_fkey') THEN
        ALTER TABLE "template_activities" ADD CONSTRAINT "template_activities_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itineraries_templateId_fkey') THEN
        ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "itinerary_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itinerary_items_restaurantId_fkey') THEN
        ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itinerary_items_accommodationId_fkey') THEN
        ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
