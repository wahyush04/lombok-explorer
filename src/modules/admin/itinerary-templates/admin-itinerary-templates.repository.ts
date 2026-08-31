import { Prisma, ItineraryTemplate } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import {
  AdminTemplateFilterQuery,
  CreateItineraryTemplateInput,
  UpdateItineraryTemplateInput,
} from './dto/admin-itinerary-template.dto';

export class AdminItineraryTemplatesRepository {
  public async findMany(
    filter: AdminTemplateFilterQuery,
  ): Promise<{ items: ItineraryTemplate[]; total: number }> {
    const { page, limit, search, travelStyle, budgetLevel, isPublished, isFeatured, sortBy, order } =
      filter;
    const skip = (page - 1) * limit;

    const where: Prisma.ItineraryTemplateWhereInput = {
      deletedAt: null,
      ...(isPublished !== undefined && { isPublished }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(travelStyle && { travelStyle }),
      ...(budgetLevel && { budgetLevel }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.itineraryTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
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

  public async findById(id: string): Promise<ItineraryTemplate | null> {
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

  public async create(data: CreateItineraryTemplateInput): Promise<ItineraryTemplate> {
    const { days, ...templateFields } = data;

    return prisma.$transaction(async (tx) => {
      const template = await tx.itineraryTemplate.create({
        data: {
          ...templateFields,
          days: days && days.length > 0
            ? {
                create: days.map((day) => ({
                  dayNumber: day.dayNumber,
                  title: day.title,
                  notes: day.notes,
                  totalDistanceKm: day.totalDistanceKm,
                  totalDurationMinutes: day.totalDurationMinutes,
                  estimatedBudget: day.estimatedBudget,
                  activities: {
                    create: (day.activities || []).map((act, actIdx) => ({
                      destinationId: act.destinationId || null,
                      customLocation: act.customLocation || null,
                      customTitle: act.customTitle || null,
                      orderIndex: act.orderIndex ?? actIdx,
                      startTime: act.startTime || null,
                      endTime: act.endTime || null,
                      activityNotes: act.activityNotes || null,
                      estimatedDurationMinutes: act.estimatedDurationMinutes || 60,
                      estimatedCost: act.estimatedCost || 0,
                      distanceFromPrevKm: act.distanceFromPrevKm || 0,
                      travelTimeFromPrevMinutes: act.travelTimeFromPrevMinutes || 0,
                    })),
                  },
                })),
              }
            : undefined,
        },
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              activities: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: true,
                },
              },
            },
          },
        },
      });

      return template;
    });
  }

  public async update(id: string, data: UpdateItineraryTemplateInput): Promise<ItineraryTemplate> {
    const { days, ...templateFields } = data;

    return prisma.$transaction(async (tx) => {
      if (days !== undefined) {
        // If days are provided in update, replace template days & activities
        await tx.templateActivity.deleteMany({
          where: { templateDay: { templateId: id } },
        });
        await tx.templateDay.deleteMany({
          where: { templateId: id },
        });

        if (days.length > 0) {
          for (const day of days) {
            await tx.templateDay.create({
              data: {
                templateId: id,
                dayNumber: day.dayNumber,
                title: day.title,
                notes: day.notes,
                totalDistanceKm: day.totalDistanceKm,
                totalDurationMinutes: day.totalDurationMinutes,
                estimatedBudget: day.estimatedBudget,
                activities: {
                  create: (day.activities || []).map((act, actIdx) => ({
                    destinationId: act.destinationId || null,
                    customLocation: act.customLocation || null,
                    customTitle: act.customTitle || null,
                    orderIndex: act.orderIndex ?? actIdx,
                    startTime: act.startTime || null,
                    endTime: act.endTime || null,
                    activityNotes: act.activityNotes || null,
                    estimatedDurationMinutes: act.estimatedDurationMinutes || 60,
                    estimatedCost: act.estimatedCost || 0,
                    distanceFromPrevKm: act.distanceFromPrevKm || 0,
                    travelTimeFromPrevMinutes: act.travelTimeFromPrevMinutes || 0,
                  })),
                },
              },
            });
          }
        }
      }

      return tx.itineraryTemplate.update({
        where: { id },
        data: templateFields,
        include: {
          days: {
            orderBy: { dayNumber: 'asc' },
            include: {
              activities: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  destination: true,
                },
              },
            },
          },
        },
      });
    });
  }

  public async delete(id: string): Promise<ItineraryTemplate> {
    return prisma.itineraryTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const adminItineraryTemplatesRepository = new AdminItineraryTemplatesRepository();
