-- CreateTable
CREATE TABLE IF NOT EXISTS "restaurant_images" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "caption" TEXT,
    "altText" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accommodation_images" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "caption" TEXT,
    "altText" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accommodation_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "restaurant_images_restaurantId_idx" ON "restaurant_images"("restaurantId");
CREATE INDEX IF NOT EXISTS "restaurant_images_orderIndex_idx" ON "restaurant_images"("orderIndex");

CREATE INDEX IF NOT EXISTS "accommodation_images_accommodationId_idx" ON "accommodation_images"("accommodationId");
CREATE INDEX IF NOT EXISTS "accommodation_images_orderIndex_idx" ON "accommodation_images"("orderIndex");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_images_restaurantId_fkey'
    ) THEN
        ALTER TABLE "restaurant_images" ADD CONSTRAINT "restaurant_images_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accommodation_images_accommodationId_fkey'
    ) THEN
        ALTER TABLE "accommodation_images" ADD CONSTRAINT "accommodation_images_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Migrate existing JSON array images from accommodations and restaurants to the new relational tables
DO $$
DECLARE
    r RECORD;
    img_url TEXT;
    idx INT;
    json_arr JSONB;
BEGIN
    -- 1. Accommodations data migration (only if column 'images' still exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accommodations' AND column_name = 'images'
    ) THEN
        FOR r IN EXECUTE 'SELECT id, "coverImageUrl", "coverImagePublicId", images FROM accommodations WHERE images IS NOT NULL AND images != '''' AND images != ''[]''' LOOP
            BEGIN
                json_arr := r.images::jsonb;
                IF jsonb_typeof(json_arr) = 'array' THEN
                    idx := 0;
                    FOR img_url IN SELECT jsonb_array_elements_text(json_arr) LOOP
                        INSERT INTO accommodation_images ("id", "accommodationId", "imageUrl", "imagePublicId", "orderIndex", "isPrimary", "createdAt", "updatedAt")
                        VALUES (
                            gen_random_uuid()::text,
                            r.id,
                            img_url,
                            NULL,
                            idx,
                            (idx = 0),
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        );
                        idx := idx + 1;
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                IF r.images IS NOT NULL AND length(trim(r.images::text)) > 0 THEN
                    INSERT INTO accommodation_images ("id", "accommodationId", "imageUrl", "imagePublicId", "orderIndex", "isPrimary", "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, r.id, r.images::text, NULL, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                END IF;
            END;
        END LOOP;
        
        ALTER TABLE "accommodations" DROP COLUMN "images";
    END IF;

    -- 2. Restaurants data migration (only if column 'images' still exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurants' AND column_name = 'images'
    ) THEN
        FOR r IN EXECUTE 'SELECT id, "coverImageUrl", "coverImagePublicId", images FROM restaurants WHERE images IS NOT NULL AND images != '''' AND images != ''[]''' LOOP
            BEGIN
                json_arr := r.images::jsonb;
                IF jsonb_typeof(json_arr) = 'array' THEN
                    idx := 0;
                    FOR img_url IN SELECT jsonb_array_elements_text(json_arr) LOOP
                        INSERT INTO restaurant_images ("id", "restaurantId", "imageUrl", "imagePublicId", "orderIndex", "isPrimary", "createdAt", "updatedAt")
                        VALUES (
                            gen_random_uuid()::text,
                            r.id,
                            img_url,
                            NULL,
                            idx,
                            (idx = 0),
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        );
                        idx := idx + 1;
                    END LOOP;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                IF r.images IS NOT NULL AND length(trim(r.images::text)) > 0 THEN
                    INSERT INTO restaurant_images ("id", "restaurantId", "imageUrl", "imagePublicId", "orderIndex", "isPrimary", "createdAt", "updatedAt")
                    VALUES (gen_random_uuid()::text, r.id, r.images::text, NULL, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                END IF;
            END;
        END LOOP;

        ALTER TABLE "restaurants" DROP COLUMN "images";
    END IF;
END $$;
