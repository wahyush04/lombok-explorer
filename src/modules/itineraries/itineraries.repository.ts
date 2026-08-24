import { BudgetLevel, Prisma, TravelStyle } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ItineraryDayInput } from './dto/itinerary.dto';

export interface ItineraryFilterOptions {
  userId?: string;
  isPublic?: boolean;
  travelStyle?: TravelStyle;
  budgetLevel?: BudgetLevel;
  search?: string;
  page: number;
  limit: number;
}

export class ItinerariesRepository {
  public async findMany(filters: ItineraryFilterOptions) {
    const where: Prisma.ItineraryWhereInput = {
      deletedAt: null,
    };

    if (filters.userId && filters.isPublic === undefined) {
      where.OR = [{ userId: filters.userId }, { isPublic: true }];
    } else if (filters.userId && filters.isPublic === false) {
      where.userId = filters.userId;
    } else if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters.travelStyle) {
      where.travelStyle = filters.travelStyle;
    }

    if (filters.budgetLevel) {
      where.budgetLevel = filters.budgetLevel;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search.trim() } },
        { description: { contains: filters.search.trim() } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.itinerary.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    include: { category: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.itinerary.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string) {
    return prisma.itinerary.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  include: { category: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Creates an itinerary with multiple days and items inside a single database transaction.
   */
  public async createWithTransaction(
    masterData: {
      userId?: string | null;
      title: string;
      description?: string | null;
      coverImageUrl?: string | null;
      totalDays: number;
      totalEstimatedBudget: number;
      travelStyle: TravelStyle;
      budgetLevel: BudgetLevel;
      pace: string;
      isPublic: boolean;
      startDate?: Date | null;
      endDate?: Date | null;
    },
    days: ItineraryDayInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Itinerary
      const itinerary = await tx.itinerary.create({
        data: {
          userId: masterData.userId,
          title: masterData.title,
          description: masterData.description,
          coverImageUrl: masterData.coverImageUrl,
          totalDays: masterData.totalDays,
          totalEstimatedBudget: new Prisma.Decimal(masterData.totalEstimatedBudget),
          travelStyle: masterData.travelStyle,
          budgetLevel: masterData.budgetLevel,
          pace: masterData.pace,
          isPublic: masterData.isPublic,
          startDate: masterData.startDate,
          endDate: masterData.endDate,
        },
      });

      // 2. Create Days and Items
      for (const [dayIdx, dayInput] of days.entries()) {
        const dayNumber = dayInput.dayNumber ?? dayIdx + 1;
        const dayDate = dayInput.date ? new Date(dayInput.date) : null;

        const day = await tx.itineraryDay.create({
          data: {
            itineraryId: itinerary.id,
            dayNumber,
            title: dayInput.title,
            date: dayDate,
            notes: dayInput.notes,
          },
        });

        const itemsInput = dayInput.activities || dayInput.items || [];
        for (const [itemIdx, item] of itemsInput.entries()) {
          const timeSlot =
            item.timeSlot ||
            (item.startTime && item.endTime
              ? `${item.startTime} - ${item.endTime}`
              : item.startTime || null);

          await tx.itineraryItem.create({
            data: {
              itineraryDayId: day.id,
              destinationId: item.destinationId || null,
              customTitle: item.customTitle || null,
              orderIndex: item.orderIndex ?? itemIdx + 1,
              timeSlot,
              activityNotes: item.activityNotes || null,
              estimatedDurationMinutes: item.estimatedDurationMinutes ?? 60,
              estimatedCost: new Prisma.Decimal(item.estimatedCost ?? 0),
            },
          });
        }
      }

      // 3. Return full loaded entity
      return tx.itinerary.findUniqueOrThrow({
        where: { id: itinerary.id },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    include: { category: true },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Updates an itinerary master data and replaces days/items inside a single database transaction.
   */
  public async updateWithTransaction(
    id: string,
    masterData: {
      title?: string;
      description?: string | null;
      coverImageUrl?: string | null;
      totalDays?: number;
      totalEstimatedBudget?: number;
      travelStyle?: TravelStyle;
      budgetLevel?: BudgetLevel;
      pace?: string;
      isPublic?: boolean;
      startDate?: Date | null;
      endDate?: Date | null;
    },
    days?: ItineraryDayInput[],
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. If days provided, replace existing days
      if (days && days.length > 0) {
        await tx.itineraryDay.deleteMany({
          where: { itineraryId: id },
        });

        for (const [dayIdx, dayInput] of days.entries()) {
          const dayNumber = dayInput.dayNumber ?? dayIdx + 1;
          const dayDate = dayInput.date ? new Date(dayInput.date) : null;

          const day = await tx.itineraryDay.create({
            data: {
              itineraryId: id,
              dayNumber,
              title: dayInput.title,
              date: dayDate,
              notes: dayInput.notes,
            },
          });

          const itemsInput = dayInput.activities || dayInput.items || [];
          for (const [itemIdx, item] of itemsInput.entries()) {
            const timeSlot =
              item.timeSlot ||
              (item.startTime && item.endTime
                ? `${item.startTime} - ${item.endTime}`
                : item.startTime || null);

            await tx.itineraryItem.create({
              data: {
                itineraryDayId: day.id,
                destinationId: item.destinationId || null,
                customTitle: item.customTitle || null,
                orderIndex: item.orderIndex ?? itemIdx + 1,
                timeSlot,
                activityNotes: item.activityNotes || null,
                estimatedDurationMinutes: item.estimatedDurationMinutes ?? 60,
                estimatedCost: new Prisma.Decimal(item.estimatedCost ?? 0),
              },
            });
          }
        }
      }

      // 2. Update master data
      await tx.itinerary.update({
        where: { id },
        data: {
          ...(masterData.title && { title: masterData.title }),
          ...(masterData.description !== undefined && { description: masterData.description }),
          ...(masterData.coverImageUrl !== undefined && {
            coverImageUrl: masterData.coverImageUrl,
          }),
          ...(masterData.totalDays !== undefined && { totalDays: masterData.totalDays }),
          ...(masterData.totalEstimatedBudget !== undefined && {
            totalEstimatedBudget: new Prisma.Decimal(masterData.totalEstimatedBudget),
          }),
          ...(masterData.travelStyle && { travelStyle: masterData.travelStyle }),
          ...(masterData.budgetLevel && { budgetLevel: masterData.budgetLevel }),
          ...(masterData.pace && { pace: masterData.pace }),
          ...(masterData.isPublic !== undefined && { isPublic: masterData.isPublic }),
          ...(masterData.startDate !== undefined && { startDate: masterData.startDate }),
          ...(masterData.endDate !== undefined && { endDate: masterData.endDate }),
        },
      });

      // 3. Return updated full loaded entity
      return tx.itinerary.findUniqueOrThrow({
        where: { id },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    include: { category: true },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  public async delete(id: string) {
    return prisma.itinerary.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const itinerariesRepository = new ItinerariesRepository();
