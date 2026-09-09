-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FavoriteType') THEN
        CREATE TYPE "FavoriteType" AS ENUM ('DESTINATION', 'ACCOMMODATION', 'RESTAURANT');
    END IF;
END $$;

-- AlterTable favorites: Add type, make destinationId optional, add accommodationId and restaurantId
ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "type" "FavoriteType" NOT NULL DEFAULT 'DESTINATION';
ALTER TABLE "favorites" ALTER COLUMN "destinationId" DROP NOT NULL;
ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "accommodationId" TEXT;
ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "restaurantId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "favorites_accommodationId_idx" ON "favorites"("accommodationId");
CREATE INDEX IF NOT EXISTS "favorites_restaurantId_idx" ON "favorites"("restaurantId");
CREATE INDEX IF NOT EXISTS "favorites_type_idx" ON "favorites"("type");

-- AddForeignKey and Unique Constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorites_accommodationId_fkey'
    ) THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorites_restaurantId_fkey'
    ) THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorites_userId_accommodationId_key'
    ) THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_accommodationId_key" UNIQUE ("userId", "accommodationId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorites_userId_restaurantId_key'
    ) THEN
        ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_restaurantId_key" UNIQUE ("userId", "restaurantId");
    END IF;
END $$;
