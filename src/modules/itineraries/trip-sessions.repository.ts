import { Prisma, TripSession, TripActivityProgress, TripRoute, TripSessionStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface CreateSessionInput {
  userId: string;
  itineraryId: string;
  status?: TripSessionStatus;
  currentActivityId?: string | null;
  routeSnapshot?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastAccuracy?: number | null;
  lastLocationAt?: Date | null;
}

export interface CreateProgressItemInput {
  itineraryActivityId: string;
  status?: import('@prisma/client').TripActivityStatus;
  orderIndex: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface CreateTripRouteLegInput {
  fromActivityId: string | null;
  toActivityId: string;
  legOrder: number;
  distanceMeters: number;
  durationSeconds: number;
  geometry: string;
}

export class TripSessionsRepository {
  /**
   * Creates a new TripSession, its initial progress records, and route legs atomically.
   */
  public async createSession(
    sessionData: CreateSessionInput,
    progressItems: CreateProgressItemInput[],
    routeLegs: CreateTripRouteLegInput[] = [],
  ): Promise<TripSession & { activityProgress: TripActivityProgress[]; routes: TripRoute[] }> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.tripSession.create({
        data: {
          userId: sessionData.userId,
          itineraryId: sessionData.itineraryId,
          status: sessionData.status || 'ACTIVE',
          currentActivityId: sessionData.currentActivityId || null,
          routeSnapshot: sessionData.routeSnapshot || null,
          lastLatitude: sessionData.lastLatitude || null,
          lastLongitude: sessionData.lastLongitude || null,
          lastAccuracy: sessionData.lastAccuracy || null,
          lastLocationAt: sessionData.lastLocationAt || null,
        },
      });

      if (progressItems.length > 0) {
        await tx.tripActivityProgress.createMany({
          data: progressItems.map((item) => ({
            tripSessionId: session.id,
            itineraryActivityId: item.itineraryActivityId,
            status: item.status || 'NOT_STARTED',
            orderIndex: item.orderIndex,
            startedAt: item.startedAt || null,
            completedAt: item.completedAt || null,
          })),
        });
      }

      if (routeLegs.length > 0) {
        await tx.tripRoute.createMany({
          data: routeLegs.map((leg) => ({
            tripSessionId: session.id,
            fromActivityId: leg.fromActivityId,
            toActivityId: leg.toActivityId,
            legOrder: leg.legOrder,
            distanceMeters: leg.distanceMeters,
            durationSeconds: leg.durationSeconds,
            geometry: leg.geometry,
          })),
        });
      }

      const createdProgress = await tx.tripActivityProgress.findMany({
        where: { tripSessionId: session.id },
        orderBy: { orderIndex: 'asc' },
      });

      const createdRoutes = await tx.tripRoute.findMany({
        where: { tripSessionId: session.id },
        orderBy: { legOrder: 'asc' },
      });

      return {
        ...session,
        activityProgress: createdProgress,
        routes: createdRoutes,
      };
    });
  }

  /**
   * Finds the currently active TripSession for a user with progress, routes, and itinerary items.
   */
  public async findActiveSessionByUserId(userId: string) {
    return prisma.tripSession.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        activityProgress: {
          orderBy: { orderIndex: 'asc' },
        },
        routes: {
          orderBy: { legOrder: 'asc' },
        },
        itinerary: {
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                items: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    destination: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                        locationName: true,
                      },
                    },
                    restaurant: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                      },
                    },
                    accommodation: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Finds an active TripSession for a specific itinerary (used in active itinerary reconciliation).
   */
  public async findActiveSessionByItineraryId(itineraryId: string) {
    return prisma.tripSession.findFirst({
      where: {
        itineraryId,
        status: 'ACTIVE',
      },
      include: {
        activityProgress: {
          orderBy: { orderIndex: 'asc' },
        },
        routes: {
          orderBy: { legOrder: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Finds a TripSession by primary key ID.
   */
  public async findById(id: string) {
    return prisma.tripSession.findUnique({
      where: { id },
      include: {
        activityProgress: {
          orderBy: { orderIndex: 'asc' },
        },
        routes: {
          orderBy: { legOrder: 'asc' },
        },
        itinerary: {
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                items: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    destination: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                        locationName: true,
                      },
                    },
                    restaurant: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                      },
                    },
                    accommodation: {
                      select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        address: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Updates an existing TripSession.
   */
  public async updateSession(id: string, data: Prisma.TripSessionUpdateInput) {
    return prisma.tripSession.update({
      where: { id },
      data,
    });
  }

  /**
   * Replaces all routes for a session atomically.
   */
  public async replaceRoutes(
    tripSessionId: string,
    routeLegs: CreateTripRouteLegInput[],
  ): Promise<TripRoute[]> {
    return prisma.$transaction(async (tx) => {
      await tx.tripRoute.deleteMany({
        where: { tripSessionId },
      });

      if (routeLegs.length > 0) {
        await tx.tripRoute.createMany({
          data: routeLegs.map((leg) => ({
            tripSessionId,
            fromActivityId: leg.fromActivityId,
            toActivityId: leg.toActivityId,
            legOrder: leg.legOrder,
            distanceMeters: leg.distanceMeters,
            durationSeconds: leg.durationSeconds,
            geometry: leg.geometry,
          })),
        });
      }

      return tx.tripRoute.findMany({
        where: { tripSessionId },
        orderBy: { legOrder: 'asc' },
      });
    });
  }

  /**
   * Finds all route legs for a trip session.
   */
  public async findRoutesBySessionId(tripSessionId: string): Promise<TripRoute[]> {
    return prisma.tripRoute.findMany({
      where: { tripSessionId },
      orderBy: { legOrder: 'asc' },
    });
  }

  /**
   * Finds a specific progress record by session ID and activity ID.
   */
  public async findProgressBySessionAndActivity(tripSessionId: string, itineraryActivityId: string) {
    return prisma.tripActivityProgress.findUnique({
      where: {
        tripSessionId_itineraryActivityId: {
          tripSessionId,
          itineraryActivityId,
        },
      },
    });
  }

  /**
   * Updates a specific activity progress record.
   */
  public async updateProgress(id: string, data: Prisma.TripActivityProgressUpdateInput) {
    return prisma.tripActivityProgress.update({
      where: { id },
      data,
    });
  }

  /**
   * Creates or upserts a progress record for an activity.
   */
  public async upsertProgress(
    tripSessionId: string,
    itineraryActivityId: string,
    data: {
      status?: import('@prisma/client').TripActivityStatus;
      orderIndex: number;
    },
  ) {
    return prisma.tripActivityProgress.upsert({
      where: {
        tripSessionId_itineraryActivityId: {
          tripSessionId,
          itineraryActivityId,
        },
      },
      create: {
        tripSessionId,
        itineraryActivityId,
        status: data.status || 'NOT_STARTED',
        orderIndex: data.orderIndex,
      },
      update: {
        orderIndex: data.orderIndex,
      },
    });
  }

  /**
   * Deletes a progress record for an activity.
   */
  public async deleteProgress(tripSessionId: string, itineraryActivityId: string) {
    return prisma.tripActivityProgress.deleteMany({
      where: {
        tripSessionId,
        itineraryActivityId,
      },
    });
  }

  /**
   * Retrieves all progress items for a trip session.
   */
  public async findProgressListBySession(tripSessionId: string) {
    return prisma.tripActivityProgress.findMany({
      where: { tripSessionId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Batch updates orderIndex for progress items.
   */
  public async updateProgressOrders(
    tripSessionId: string,
    orderUpdates: { itineraryActivityId: string; orderIndex: number }[],
  ) {
    return prisma.$transaction(
      orderUpdates.map((u) =>
        prisma.tripActivityProgress.updateMany({
          where: {
            tripSessionId,
            itineraryActivityId: u.itineraryActivityId,
          },
          data: {
            orderIndex: u.orderIndex,
          },
        }),
      ),
    );
  }
}

export const tripSessionsRepository = new TripSessionsRepository();
