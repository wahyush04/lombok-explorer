-- CreateEnum
CREATE TYPE "TripSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripActivityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable trip_sessions
CREATE TABLE "trip_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "status" "TripSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "currentActivityId" TEXT,
    "routeSnapshot" TEXT,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastAccuracy" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable trip_activity_progress
CREATE TABLE "trip_activity_progress" (
    "id" TEXT NOT NULL,
    "tripSessionId" TEXT NOT NULL,
    "itineraryActivityId" TEXT NOT NULL,
    "status" "TripActivityStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "arrivalDetectedAt" TIMESTAMP(3),
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastAccuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_activity_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_sessions_userId_status_idx" ON "trip_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "trip_sessions_itineraryId_status_idx" ON "trip_sessions"("itineraryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trip_activity_progress_tripSessionId_itineraryActivityId_key" ON "trip_activity_progress"("tripSessionId", "itineraryActivityId");

-- CreateIndex
CREATE INDEX "trip_activity_progress_tripSessionId_status_idx" ON "trip_activity_progress"("tripSessionId", "status");

-- CreateIndex
CREATE INDEX "trip_activity_progress_itineraryActivityId_idx" ON "trip_activity_progress"("itineraryActivityId");

-- AddForeignKey
ALTER TABLE "trip_sessions" ADD CONSTRAINT "trip_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_sessions" ADD CONSTRAINT "trip_sessions_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_activity_progress" ADD CONSTRAINT "trip_activity_progress_tripSessionId_fkey" FOREIGN KEY ("tripSessionId") REFERENCES "trip_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_activity_progress" ADD CONSTRAINT "trip_activity_progress_itineraryActivityId_fkey" FOREIGN KEY ("itineraryActivityId") REFERENCES "itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
