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

export type TemplateWithRelations = Prisma.ItineraryTemplateGetPayload<{
  include: {
    days: {
      include: {
        activities: {
          include: {
            destination: {
              include: {
                category: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export class ItinerariesRepository {
  public async findMany(filters: ItineraryFilterOptions) {
    const where: Prisma.ItineraryWhereInput = {
      deletedAt: null,
      userId: filters.userId, // Strict user isolation
    };

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
      // 1 user hanya bisa memiliki 1 trip plan active (archive previous active trips)
      if (masterData.userId) {
        await tx.itinerary.updateMany({
          where: {
            userId: masterData.userId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      }

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
          isPublic: false,
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

        const items = Array.isArray(dayData.items)
          ? (dayData.items as Record<string, unknown>[])
          : [];
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
    totals: {
      totalDistanceKm: number;
      totalTravelTimeMinutes: number;
      totalEstimatedBudget: number;
    },
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

  public async findActiveTripByUserId(userId: string) {
    return prisma.itinerary.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  public async findRecommendations(filter: {
    travel_style?: TravelStyle;
    travelStyle?: TravelStyle;
    duration_days?: number;
    durationDays?: number;
    limit?: number;
  }) {
    const travelStyle = filter.travel_style || filter.travelStyle;
    const durationDays = filter.duration_days || filter.durationDays;
    const limit = filter.limit || 6;

    const where: Prisma.ItineraryTemplateWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(travelStyle && { travelStyle }),
      ...(durationDays && { totalDays: durationDays }),
    };

    return prisma.itineraryTemplate.findMany({
      where,
      take: limit,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    coverImageUrl: true,
                    latitude: true,
                    longitude: true,
                    rating: true,
                    category: { select: { id: true, name: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  public async findBrowseTemplates(filter: {
    query?: string;
    q?: string;
    search?: string;
    duration_filter?:
      'ALL' | '1_DAY' | '2_3_DAYS' | '4_PLUS_DAYS' | '1_3_DAYS' | '4_7_DAYS' | 'MORE_7_DAYS';
    durationFilter?:
      'ALL' | '1_DAY' | '2_3_DAYS' | '4_PLUS_DAYS' | '1_3_DAYS' | '4_7_DAYS' | 'MORE_7_DAYS';
    travel_style?: TravelStyle;
    travelStyle?: TravelStyle;
    budget_level?: BudgetLevel;
    budgetLevel?: BudgetLevel;
    page?: number;
    limit?: number;
  }) {
    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const skip = (page - 1) * limit;
    const search = filter.query || filter.q || filter.search;
    const durationFilter = filter.duration_filter || filter.durationFilter || 'ALL';
    const travelStyle = filter.travel_style || filter.travelStyle;
    const budgetLevel = filter.budget_level || filter.budgetLevel;

    const where: Prisma.ItineraryTemplateWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(travelStyle && { travelStyle }),
      ...(budgetLevel && { budgetLevel }),
    };

    if (durationFilter === '1_3_DAYS') {
      where.totalDays = { gte: 1, lte: 3 };
    } else if (durationFilter === '4_7_DAYS') {
      where.totalDays = { gte: 4, lte: 7 };
    } else if (durationFilter === 'MORE_7_DAYS') {
      where.totalDays = { gt: 7 };
    } else if (durationFilter === '1_DAY') {
      where.totalDays = 1;
    } else if (durationFilter === '2_3_DAYS') {
      where.totalDays = { in: [2, 3] };
    } else if (durationFilter === '4_PLUS_DAYS') {
      where.totalDays = { gte: 4 };
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        {
          days: {
            some: {
              activities: {
                some: {
                  OR: [
                    { customTitle: { contains: term, mode: 'insensitive' } },
                    { destination: { name: { contains: term, mode: 'insensitive' } } },
                    { destination: { description: { contains: term, mode: 'insensitive' } } },
                  ],
                },
              },
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.itineraryTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              activities: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      coverImageUrl: true,
                      latitude: true,
                      longitude: true,
                      rating: true,
                      category: { select: { id: true, name: true, slug: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.itineraryTemplate.count({ where }),
    ]);

    return { items, total };
  }

  public async findTemplateById(id: string) {
    return prisma.itineraryTemplate.findFirst({
      where: { id, deletedAt: null },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { orderIndex: 'asc' },
              include: {
                destination: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  public async cloneTemplateToUserItinerary(
    template: TemplateWithRelations,
    userId: string,
    customTitle?: string,
    startDate?: string,
  ) {
    const baseDate = startDate ? new Date(startDate) : null;
    const endDate =
      baseDate && template.totalDays > 1
        ? new Date(baseDate.getTime() + (template.totalDays - 1) * 24 * 60 * 60 * 1000)
        : baseDate;

    return prisma.$transaction(async (tx) => {
      // 1 user hanya bisa memiliki 1 trip plan active (archive previous active trips)
      await tx.itinerary.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      const newItinerary = await tx.itinerary.create({
        data: {
          userId,
          templateId: template.id,
          title: customTitle || template.title,
          description: template.description,
          coverImageUrl: template.coverImageUrl,
          totalDays: template.totalDays,
          totalEstimatedBudget: template.totalEstimatedBudget,
          travelStyle: template.travelStyle,
          budgetLevel: template.budgetLevel,
          transportationMode: template.transportationMode,
          totalDistanceKm: template.totalDistanceKm,
          totalTravelTimeMinutes: template.totalDurationMinutes,
          isCustom: false,
          isPublic: false,
          isSaved: true,
          startDate: baseDate,
          endDate,
          days: {
            create: template.days.map((day) => {
              const dayDate = baseDate
                ? new Date(baseDate.getTime() + (day.dayNumber - 1) * 24 * 60 * 60 * 1000)
                : null;

              return {
                dayNumber: day.dayNumber,
                title: day.title,
                date: dayDate,
                notes: day.notes,
                totalDistanceKm: day.totalDistanceKm,
                totalTravelTimeMinutes: day.totalDurationMinutes,
                estimatedBudget: day.estimatedBudget,
                items: {
                  create: day.activities.map((act) => ({
                    destinationId: act.destinationId,
                    customLocation: act.customLocation,
                    customTitle: act.customTitle,
                    orderIndex: act.orderIndex,
                    startTime: act.startTime,
                    endTime: act.endTime,
                    timeSlot:
                      act.startTime && act.endTime ? `${act.startTime} - ${act.endTime}` : null,
                    activityNotes: act.activityNotes,
                    estimatedDurationMinutes: act.estimatedDurationMinutes,
                    estimatedCost: act.estimatedCost,
                    distanceFromPrevKm: act.distanceFromPrevKm,
                    travelTimeFromPrevMinutes: act.travelTimeFromPrevMinutes,
                    isCompleted: false,
                  })),
                },
              };
            }),
          },
        },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: {
                    include: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return newItinerary;
    });
  }
}

export const itinerariesRepository = new ItinerariesRepository();
