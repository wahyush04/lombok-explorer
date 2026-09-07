-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_translations" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_translations" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodation_translations" (
    "id" TEXT NOT NULL,
    "accommodationId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_template_translations" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "transportPaceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_template_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_locale_key" ON "category_translations"("categoryId", "locale");
CREATE INDEX "category_translations_locale_idx" ON "category_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destinationId_locale_key" ON "destination_translations"("destinationId", "locale");
CREATE INDEX "destination_translations_locale_idx" ON "destination_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_translations_restaurantId_locale_key" ON "restaurant_translations"("restaurantId", "locale");
CREATE INDEX "restaurant_translations_locale_idx" ON "restaurant_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_translations_accommodationId_locale_key" ON "accommodation_translations"("accommodationId", "locale");
CREATE INDEX "accommodation_translations_locale_idx" ON "accommodation_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_template_translations_templateId_locale_key" ON "itinerary_template_translations"("templateId", "locale");
CREATE INDEX "itinerary_template_translations_locale_idx" ON "itinerary_template_translations"("locale");

-- AddForeignKey
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_translations" ADD CONSTRAINT "restaurant_translations_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accommodation_translations" ADD CONSTRAINT "accommodation_translations_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_template_translations" ADD CONSTRAINT "itinerary_template_translations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "itinerary_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================
-- SAFE NON-DESTRUCTIVE DATA MIGRATION: SEED 'id-ID' CONTENT
-- =========================================================

-- Seed Category translations
INSERT INTO "category_translations" ("id", "categoryId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    'id-ID',
    c."name",
    c."description",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "categories" c
ON CONFLICT ("categoryId", "locale") DO NOTHING;

-- Seed Destination translations
INSERT INTO "destination_translations" ("id", "destinationId", "locale", "name", "shortDescription", "description", "address", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    d."id",
    'id-ID',
    d."name",
    d."shortDescription",
    d."description",
    d."address",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "destinations" d
ON CONFLICT ("destinationId", "locale") DO NOTHING;

-- Seed Restaurant translations
INSERT INTO "restaurant_translations" ("id", "restaurantId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    r."id",
    'id-ID',
    r."name",
    r."description",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "restaurants" r
ON CONFLICT ("restaurantId", "locale") DO NOTHING;

-- Seed Accommodation translations
INSERT INTO "accommodation_translations" ("id", "accommodationId", "locale", "name", "description", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    a."id",
    'id-ID',
    a."name",
    a."description",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "accommodations" a
ON CONFLICT ("accommodationId", "locale") DO NOTHING;

-- Seed ItineraryTemplate translations
INSERT INTO "itinerary_template_translations" ("id", "templateId", "locale", "title", "description", "transportPaceNote", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    t."id",
    'id-ID',
    t."title",
    t."description",
    t."transportPaceNote",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "itinerary_templates" t
ON CONFLICT ("templateId", "locale") DO NOTHING;
