import { Prisma, TripSession, TripActivityProgress, TripSessionStatus } from '@prisma/client';
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

export class TripSessionsRepository {
  /**
   * Creates a new TripSession and its initial TripActivityProgress records atomically.
   */
  public async createSession(
    sessionData: CreateSessionInput,
    progressItems: CreateProgressItemInput[],
  ): Promise<TripSession & { activityProgress: TripActivityProgress[] }> {
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

      const createdProgress = await tx.tripActivityProgress.findMany({
        where: { tripSessionId: session.id },
        orderBy: { orderIndex: 'asc' },
      });

      return {
        ...session,
        activityProgress: createdProgress,
      };
    });
  }

  /**
   * Finds the currently active TripSession for a user.
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
