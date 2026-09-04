-- Enable PostgreSQL Trigram and Unaccent Extensions for high-performance Full-Text Search and fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Trigram GIN Indexes for fast typo tolerance and fuzzy matching on names/titles
CREATE INDEX IF NOT EXISTS idx_destinations_name_trgm ON destinations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_destinations_location_trgm ON destinations USING gin ("locationName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm ON restaurants USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_accommodations_name_trgm ON accommodations USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_itinerary_templates_title_trgm ON itinerary_templates USING gin (title gin_trgm_ops);

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
    setweight(to_tsvector('simple', coalesce(type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(address, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(amenities, '')), 'D')
  )
);
