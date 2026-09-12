-- CreateTable trip_routes
CREATE TABLE "trip_routes" (
    "id" TEXT NOT NULL,
    "tripSessionId" TEXT NOT NULL,
    "fromActivityId" TEXT,
    "toActivityId" TEXT NOT NULL,
    "legOrder" INTEGER NOT NULL DEFAULT 0,
    "distanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "geometry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_routes_tripSessionId_fromActivityId_toActivityId_key" ON "trip_routes"("tripSessionId", "fromActivityId", "toActivityId");

-- CreateIndex
CREATE INDEX "trip_routes_tripSessionId_legOrder_idx" ON "trip_routes"("tripSessionId", "legOrder");

-- AddForeignKey
ALTER TABLE "trip_routes" ADD CONSTRAINT "trip_routes_tripSessionId_fkey" FOREIGN KEY ("tripSessionId") REFERENCES "trip_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
