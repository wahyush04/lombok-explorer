import { Prisma, AuditLog, User } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminAuditLogFilterQuery } from './dto/admin-audit-log.dto';

export type AuditLogWithUser = AuditLog & {
  user?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'avatarUrl'> | null;
};

export class AdminAuditLogsRepository {
  public async findMany(query: AdminAuditLogFilterQuery): Promise<{
    items: AuditLogWithUser[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    // 1. Admin/User ID filter
    const targetUserId = query.adminId || query.userId;
    if (targetUserId) {
      where.userId = targetUserId;
    }

    // 2. Action filter
    if (query.action) {
      where.action = {
        equals: query.action.trim(),
        mode: 'insensitive',
      };
    }

    // 3. Resource / Entity filter
    const targetEntity = query.resource || query.entity;
    if (targetEntity) {
      where.entity = {
        equals: targetEntity.trim(),
        mode: 'insensitive',
      };
    }

    // 4. Resource ID / Entity ID filter
    const targetEntityId = query.resourceId || query.entityId;
    if (targetEntityId) {
      where.entityId = targetEntityId;
    }

    // 5. Date range filter
    const startDateStr = query.createdFrom || query.startDate || query.fromDate;
    const endDateStr = query.createdTo || query.endDate || query.toDate;
    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        where.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        const parsedEndDate = new Date(endDateStr);
        // If date only (e.g. YYYY-MM-DD), set to end of that day
        if (endDateStr.length <= 10) {
          parsedEndDate.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = parsedEndDate;
      }
    }

    // 6. Generic search text
    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { action: { contains: searchTerm, mode: 'insensitive' } },
        { entity: { contains: searchTerm, mode: 'insensitive' } },
        { entityId: { contains: searchTerm, mode: 'insensitive' } },
        { details: { contains: searchTerm, mode: 'insensitive' } },
        { ipAddress: { contains: searchTerm, mode: 'insensitive' } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const order = query.sortOrder || query.sort_order || query.order || 'desc';

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string): Promise<AuditLogWithUser | null> {
    return prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  public async create(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: unknown;
    newValues?: unknown;
    details?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    // Redact sensitive keys before persisting
    const safeOldValues = data.oldValues ? this.redactSensitive(data.oldValues) : undefined;
    const safeNewValues = data.newValues ? this.redactSensitive(data.newValues) : undefined;
    const safeDetails = data.details ? this.redactSensitive(data.details) : undefined;

    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldValues: safeOldValues
          ? typeof safeOldValues === 'string'
            ? safeOldValues
            : JSON.stringify(safeOldValues)
          : null,
        newValues: safeNewValues
          ? typeof safeNewValues === 'string'
            ? safeNewValues
            : JSON.stringify(safeNewValues)
          : null,
        details: safeDetails
          ? typeof safeDetails === 'string'
            ? safeDetails
            : JSON.stringify(safeDetails)
          : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  private redactSensitive(data: unknown): unknown {
    if (!data) return data;
    if (typeof data !== 'object') return data;

    const sensitiveKeys = [
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'accesstoken',
      'secret',
      'apikey',
      'authorization',
    ];

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitive(item));
    }

    const cloned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        cloned[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        cloned[key] = this.redactSensitive(value);
      } else {
        cloned[key] = value;
      }
    }
    return cloned;
  }
}

export const adminAuditLogsRepository = new AdminAuditLogsRepository();
