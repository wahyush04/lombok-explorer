import { BudgetLevel, Prisma, TransportationMode, TravelStyle } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface ItineraryFilterOptions {
  userId?: string;
  isPublic?: boolean;
  travelStyle?: TravelStyle;
  budgetLevel?: BudgetLevel;
  transportationMode?: TransportationMode;
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

    if (filters.transportationMode) {
      where.transportationMode = filters.transportationMode;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: 'insensitive' } },
        { description: { contains: filters.search.trim(), mode: 'insensitive' } },
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

  public async findByShareToken(shareToken: string) {
    return prisma.itinerary.findFirst({
      where: {
        shareToken,
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

  public async findDayById(dayId: string) {
    return prisma.itineraryDay.findUnique({
      where: { id: dayId },
      include: {
        itinerary: true,
        items: {
          orderBy: { orderIndex: 'asc' },
          include: {
            destination: {
              include: { category: true },
            },
          },
        },
      },
    });
  }

  public async findActivityById(activityId: string) {
    return prisma.itineraryItem.findUnique({
      where: { id: activityId },
      include: {
        itineraryDay: {
          include: {
            itinerary: true,
          },
        },
        destination: {
          include: { category: true },
        },
      },
    });
  }

  /**
   * Creates an itinerary with initial days in a single atomic transaction.
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
      transportationMode: TransportationMode;
      startLocation?: string | null;
      endLocation?: string | null;
      pace: string;
      isCustom: boolean;
      isPublic: boolean;
      startDate?: Date | null;
      endDate?: Date | null;
    },
    daysInput: { title: string; date?: Date | null; notes?: string | null; items?: unknown[] }[],
  ) {
    return prisma.$transaction(async (tx) => {
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
          transportationMode: masterData.transportationMode,
          startLocation: masterData.startLocation,
          endLocation: masterData.endLocation,
          pace: masterData.pace,
          isCustom: masterData.isCustom,
          isPublic: masterData.isPublic,
          startDate: masterData.startDate,
          endDate: masterData.endDate,
        },
      });

      for (const [idx, dayData] of daysInput.entries()) {
        const dayNumber = idx + 1;
        const day = await tx.itineraryDay.create({
          data: {
            itineraryId: itinerary.id,
            dayNumber,
            title: dayData.title || `Hari ${dayNumber}`,
            date: dayData.date || null,
            notes: dayData.notes || null,
          },
        });

        const items = Array.isArray(dayData.items) ? (dayData.items as Record<string, unknown>[]) : [];
        for (const [itemIdx, item] of items.entries()) {
          const customLocationStr = item.customLocation
            ? typeof item.customLocation === 'string'
              ? item.customLocation
              : JSON.stringify(item.customLocation)
            : null;

          await tx.itineraryItem.create({
            data: {
              itineraryDayId: day.id,
              destinationId: (item.destinationId as string) || null,
              customLocation: customLocationStr,
              customTitle: (item.customTitle as string) || null,
              orderIndex: typeof item.orderIndex === 'number' ? item.orderIndex : itemIdx,
              timeSlot: (item.timeSlot as string) || null,
              startTime: (item.startTime as string) || null,
              endTime: (item.endTime as string) || null,
              activityNotes: ((item.activityNotes || item.notes) as string) || null,
              estimatedDurationMinutes: Number(item.estimatedDurationMinutes) || 60,
              estimatedCost: new Prisma.Decimal(Number(item.estimatedCost) || 0),
              distanceFromPrevKm: Number(item.distanceFromPrevKm) || 0,
              travelTimeFromPrevMinutes: Number(item.travelTimeFromPrevMinutes) || 0,
              isCompleted: Boolean(item.isCompleted),
            },
          });
        }
      }

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
   * Adds a new day to an itinerary and increments totalDays count.
   */
  public async addDay(
    itineraryId: string,
    dayData: { title?: string; date?: Date | null; notes?: string | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const maxDay = await tx.itineraryDay.findFirst({
        where: { itineraryId },
        orderBy: { dayNumber: 'desc' },
        select: { dayNumber: true },
      });

      const nextDayNumber = (maxDay?.dayNumber ?? 0) + 1;
      const title = dayData.title || `Hari ${nextDayNumber}`;

      const day = await tx.itineraryDay.create({
        data: {
          itineraryId,
          dayNumber: nextDayNumber,
          title,
          date: dayData.date || null,
          notes: dayData.notes || null,
        },
      });

      await tx.itinerary.update({
        where: { id: itineraryId },
        data: { totalDays: nextDayNumber },
      });

      return day;
    });
  }

  /**
   * Updates day metadata (title, date, notes).
   */
  public async updateDay(
    dayId: string,
    dayData: { title?: string; date?: Date | null; notes?: string | null },
  ) {
    return prisma.itineraryDay.update({
      where: { id: dayId },
      data: {
        ...(dayData.title !== undefined && { title: dayData.title }),
        ...(dayData.date !== undefined && { date: dayData.date }),
        ...(dayData.notes !== undefined && { notes: dayData.notes }),
      },
    });
  }

  /**
   * Deletes a day and sequentially re-indexes remaining dayNumbers in a single transaction.
   */
  public async deleteDayAndReindex(itineraryId: string, dayId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete target day
      await tx.itineraryDay.delete({
        where: { id: dayId },
      });

      // 2. Fetch remaining days ordered by current dayNumber
      const remainingDays = await tx.itineraryDay.findMany({
        where: { itineraryId },
        orderBy: { dayNumber: 'asc' },
      });

      // 3. Re-index sequentially (Day 1, 2, 3, ...)
      for (let i = 0; i < remainingDays.length; i++) {
        const d = remainingDays[i]!;
        const expectedDayNum = i + 1;
        if (d.dayNumber !== expectedDayNum) {
          // Use temporary negative number to bypass unique constraint if needed
          await tx.itineraryDay.update({
            where: { id: d.id },
            data: { dayNumber: -(expectedDayNum + 1000) },
          });
        }
      }

      for (let i = 0; i < remainingDays.length; i++) {
        const d = remainingDays[i]!;
        const expectedDayNum = i + 1;
        await tx.itineraryDay.update({
          where: { id: d.id },
          data: { dayNumber: expectedDayNum },
        });
      }

      // 4. Update totalDays on itinerary
      await tx.itinerary.update({
        where: { id: itineraryId },
        data: { totalDays: Math.max(1, remainingDays.length) },
      });
    });
  }

  /**
   * Adds an activity / stop to a specific day.
   */
  public async addActivity(
    dayId: string,
    activityData: {
      destinationId?: string | null;
      customLocation?: string | null;
      customTitle?: string | null;
      orderIndex?: number;
      startTime?: string | null;
      endTime?: string | null;
      timeSlot?: string | null;
      activityNotes?: string | null;
      estimatedDurationMinutes: number;
      estimatedCost: number;
      distanceFromPrevKm?: number;
      travelTimeFromPrevMinutes?: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      let finalOrderIndex = activityData.orderIndex;

      if (typeof finalOrderIndex !== 'number') {
        const maxActivity = await tx.itineraryItem.findFirst({
          where: { itineraryDayId: dayId },
          orderBy: { orderIndex: 'desc' },
          select: { orderIndex: true },
        });
        finalOrderIndex = (maxActivity?.orderIndex ?? -1) + 1;
      }

      return tx.itineraryItem.create({
        data: {
          itineraryDayId: dayId,
          destinationId: activityData.destinationId || null,
          customLocation: activityData.customLocation || null,
          customTitle: activityData.customTitle || null,
          orderIndex: finalOrderIndex,
          startTime: activityData.startTime || null,
          endTime: activityData.endTime || null,
          timeSlot: activityData.timeSlot || null,
          activityNotes: activityData.activityNotes || null,
          estimatedDurationMinutes: activityData.estimatedDurationMinutes,
          estimatedCost: new Prisma.Decimal(activityData.estimatedCost),
          distanceFromPrevKm: activityData.distanceFromPrevKm || 0,
          travelTimeFromPrevMinutes: activityData.travelTimeFromPrevMinutes || 0,
        },
        include: {
          destination: {
            include: { category: true },
          },
        },
      });
    });
  }

  /**
   * Updates an activity stop.
   */
  public async updateActivity(
    activityId: string,
    data: {
      destinationId?: string | null;
      customLocation?: string | null;
      customTitle?: string | null;
      orderIndex?: number;
      startTime?: string | null;
      endTime?: string | null;
      timeSlot?: string | null;
      activityNotes?: string | null;
      estimatedDurationMinutes?: number;
      estimatedCost?: number;
      distanceFromPrevKm?: number;
      travelTimeFromPrevMinutes?: number;
      isCompleted?: boolean;
    },
  ) {
    return prisma.itineraryItem.update({
      where: { id: activityId },
      data: {
        ...(data.destinationId !== undefined && { destinationId: data.destinationId }),
        ...(data.customLocation !== undefined && { customLocation: data.customLocation }),
        ...(data.customTitle !== undefined && { customTitle: data.customTitle }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.timeSlot !== undefined && { timeSlot: data.timeSlot }),
        ...(data.activityNotes !== undefined && { activityNotes: data.activityNotes }),
        ...(data.estimatedDurationMinutes !== undefined && {
          estimatedDurationMinutes: data.estimatedDurationMinutes,
        }),
        ...(data.estimatedCost !== undefined && {
          estimatedCost: new Prisma.Decimal(data.estimatedCost),
        }),
        ...(data.distanceFromPrevKm !== undefined && {
          distanceFromPrevKm: data.distanceFromPrevKm,
        }),
        ...(data.travelTimeFromPrevMinutes !== undefined && {
          travelTimeFromPrevMinutes: data.travelTimeFromPrevMinutes,
        }),
        ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
      },
      include: {
        destination: {
          include: { category: true },
        },
      },
    });
  }

  /**
   * Deletes an activity stop and re-indexes remaining activities in the day.
   */
  public async deleteActivityAndReindex(dayId: string, activityId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.itineraryItem.delete({
        where: { id: activityId },
      });

      const remaining = await tx.itineraryItem.findMany({
        where: { itineraryDayId: dayId },
        orderBy: { orderIndex: 'asc' },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.itineraryItem.update({
          where: { id: remaining[i]!.id },
          data: { orderIndex: i },
        });
      }
    });
  }

  /**
   * Atomically reorders all activities in a day.
   */
  public async reorderActivities(
    _dayId: string,
    orderedItems: { id: string; orderIndex: number }[],
  ): Promise<void> {
    return prisma.$transaction(async (tx) => {
      for (const item of orderedItems) {
        await tx.itineraryItem.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        });
      }
    });
  }

  /**
   * Updates aggregated totals on day and itinerary.
   */
  public async updateDayTotals(
    dayId: string,
    totals: { totalDistanceKm: number; totalTravelTimeMinutes: number; estimatedBudget: number },
  ) {
    return prisma.itineraryDay.update({
      where: { id: dayId },
      data: {
        totalDistanceKm: totals.totalDistanceKm,
        totalTravelTimeMinutes: totals.totalTravelTimeMinutes,
        estimatedBudget: new Prisma.Decimal(totals.estimatedBudget),
      },
    });
  }

  public async updateItineraryTotals(
    itineraryId: string,
    totals: { totalDistanceKm: number; totalTravelTimeMinutes: number; totalEstimatedBudget: number },
  ) {
    return prisma.itinerary.update({
      where: { id: itineraryId },
      data: {
        totalDistanceKm: totals.totalDistanceKm,
        totalTravelTimeMinutes: totals.totalTravelTimeMinutes,
        totalEstimatedBudget: new Prisma.Decimal(totals.totalEstimatedBudget),
      },
    });
  }

  public async updateMasterData(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      coverImageUrl?: string | null;
      travelStyle?: TravelStyle;
      budgetLevel?: BudgetLevel;
      transportationMode?: TransportationMode;
      startLocation?: string | null;
      endLocation?: string | null;
      pace?: string;
      isPublic?: boolean;
      isSaved?: boolean;
      shareToken?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
    },
  ) {
    return prisma.itinerary.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
        ...(data.travelStyle && { travelStyle: data.travelStyle }),
        ...(data.budgetLevel && { budgetLevel: data.budgetLevel }),
        ...(data.transportationMode && { transportationMode: data.transportationMode }),
        ...(data.startLocation !== undefined && { startLocation: data.startLocation }),
        ...(data.endLocation !== undefined && { endLocation: data.endLocation }),
        ...(data.pace && { pace: data.pace }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.isSaved !== undefined && { isSaved: data.isSaved }),
        ...(data.shareToken !== undefined && { shareToken: data.shareToken }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
      },
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
