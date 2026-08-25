import { Prisma, User } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminUserFilterQuery } from './dto/admin-user.dto';

export type UserWithStats = User & {
  _count?: {
    favorites: number;
    reviews: number;
    itineraries: number;
    journals: number;
  };
};

export class AdminUsersRepository {
  public async findMany(query: AdminUserFilterQuery): Promise<{
    items: UserWithStats[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const order = query.sortOrder || query.sort_order || query.order || 'desc';

    // Date range filtering
    const startDateStr = query.createdFrom || query.startDate || query.fromDate;
    const endDateStr = query.createdTo || query.endDate || query.toDate;
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (startDateStr) {
      createdAtFilter.gte = new Date(startDateStr);
    }
    if (endDateStr) {
      const parsedEndDate = new Date(endDateStr);
      if (endDateStr.length <= 10) {
        parsedEndDate.setUTCHours(23, 59, 59, 999);
      }
      createdAtFilter.lte = parsedEndDate;
    }

    const where: Prisma.UserWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.email && { email: { contains: query.email.trim(), mode: 'insensitive' } }),
      ...(Object.keys(createdAtFilter).length > 0 && { createdAt: createdAtFilter }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { email: { contains: query.search.trim(), mode: 'insensitive' } },
          { phone: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          _count: {
            select: {
              favorites: true,
              reviews: true,
              itineraries: true,
              journals: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string, includeDeleted = false): Promise<UserWithStats | null> {
    return prisma.user.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        _count: {
          select: {
            favorites: true,
            reviews: true,
            itineraries: true,
            journals: true,
          },
        },
      },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  public async update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithStats> {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            favorites: true,
            reviews: true,
            itineraries: true,
            journals: true,
          },
        },
      },
    });
  }

  public async softDelete(id: string): Promise<UserWithStats> {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        refreshToken: null,
      },
      include: {
        _count: {
          select: {
            favorites: true,
            reviews: true,
            itineraries: true,
            journals: true,
          },
        },
      },
    });
  }

  public async hardDelete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  public async createAuditLog(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch {
      // Non-blocking
    }
  }
}

export const adminUsersRepository = new AdminUsersRepository();
