-- Enable PostgreSQL Trigram and Unaccent Extensions for high-performance Full-Text Search and fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Ensure required columns exist and have compatible types for Full-Text Search and Prisma model
-- 1. destinations: convert tags and facilities from TEXT[] to TEXT if necessary, and add tips
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'destinations' AND column_name = 'tags' AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE "destinations" ALTER COLUMN "tags" DROP DEFAULT;
    ALTER TABLE "destinations" ALTER COLUMN "tags" TYPE TEXT USING coalesce(array_to_json("tags")::text, '[]');
    ALTER TABLE "destinations" ALTER COLUMN "tags" SET DEFAULT '[]';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'destinations' AND column_name = 'facilities' AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE "destinations" ALTER COLUMN "facilities" DROP DEFAULT;
    ALTER TABLE "destinations" ALTER COLUMN "facilities" TYPE TEXT USING coalesce(array_to_json("facilities")::text, '[]');
    ALTER TABLE "destinations" ALTER COLUMN "facilities" SET DEFAULT '[]';
  END IF;
END $$;

ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "tips" TEXT;

-- 2. accommodations: convert type from enum to TEXT and amenities from TEXT[] to TEXT if necessary
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accommodations' AND column_name = 'type' AND udt_name = 'AccommodationType'
  ) THEN
    ALTER TABLE "accommodations" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accommodations' AND column_name = 'amenities' AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE "accommodations" ALTER COLUMN "amenities" DROP DEFAULT;
    ALTER TABLE "accommodations" ALTER COLUMN "amenities" TYPE TEXT USING coalesce(array_to_json("amenities")::text, '[]');
    ALTER TABLE "accommodations" ALTER COLUMN "amenities" SET DEFAULT '[]';
  END IF;
END $$;

-- Trigram GIN Indexes for fast typo tolerance and fuzzy matching on names/titles
CREATE INDEX IF NOT EXISTS idx_destinations_name_trgm ON destinations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_destinations_location_trgm ON destinations USING gin ("locationName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm ON restaurants USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_accommodations_name_trgm ON accommodations USING gin (name gin_trgm_ops);

-- Expression GIN Indexes for Weighted Full-Text Search tsvector
CREATE INDEX IF NOT EXISTS idx_destinations_fts ON destinations USING gin (
  (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce("locationName", '') || ' ' || coalesce(address, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(tags, '') || ' ' || coalesce(facilities, '') || ' ' || coalesce(tips, '')), 'D')
  )
);

CREATE INDEX IF NOT EXISTS idx_restaurants_fts ON restaurants USING gin (
  (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("specialtyDish", '') || ' ' || coalesce("cuisineType", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(address, '')), 'C')
  )
);

CREATE INDEX IF NOT EXISTS idx_accommodations_fts ON accommodations USING gin (
  (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(address, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(amenities, '')), 'D')
  )
);

