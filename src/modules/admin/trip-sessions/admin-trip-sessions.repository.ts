import { prisma } from '../../../database/prisma';
import { Prisma } from '@prisma/client';
import { AdminTripSessionFilterQuery } from './dto/admin-trip-session.dto';

export class AdminTripSessionsRepository {
  public async findMany(query: AdminTripSessionFilterQuery) {
    const { page = 1, limit = 10, search, status, userId, startDate, endDate, sortBy = 'startedAt', order = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TripSessionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { itinerary: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        where.startedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) end.setUTCHours(23, 59, 59, 999);
        where.startedAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      prisma.tripSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          itinerary: {
            select: { id: true, title: true },
          },
          activityProgress: {
            select: { id: true, status: true },
          },
          routes: {
            select: { distanceMeters: true, durationSeconds: true },
          },
        },
      }),
      prisma.tripSession.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string) {
    return prisma.tripSession.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, phone: true },
        },
        itinerary: {
          select: {
            id: true,
            title: true,
            description: true,
            totalDays: true,
            days: {
              include: {
                items: {
                  include: {
                    destination: { select: { id: true, name: true, latitude: true, longitude: true, coverImageUrl: true } },
                    restaurant: { select: { id: true, name: true, latitude: true, longitude: true, coverImageUrl: true } },
                    accommodation: { select: { id: true, name: true, latitude: true, longitude: true, coverImageUrl: true } },
                  },
                  orderBy: { orderIndex: 'asc' },
                },
              },
              orderBy: { dayNumber: 'asc' },
            },
          },
        },
        routes: {
          orderBy: { legOrder: 'asc' },
        },
        activityProgress: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  public async findActiveForMap() {
    return prisma.tripSession.findMany({
      where: {
        status: 'ACTIVE',
        lastLatitude: { not: null },
        lastLongitude: { not: null },
      },
      select: {
        id: true,
        userId: true,
        itineraryId: true,
        status: true,
        lastLatitude: true,
        lastLongitude: true,
        lastLocationAt: true,
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        itinerary: {
          select: { id: true, title: true },
        },
        routes: {
          select: { distanceMeters: true, durationSeconds: true },
        },
      },
      take: 100,
    });
  }
}

export const adminTripSessionsRepository = new AdminTripSessionsRepository();
