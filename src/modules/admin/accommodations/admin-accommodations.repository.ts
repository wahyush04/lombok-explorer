import { Prisma, Accommodation } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminAccommodationFilterQuery } from './dto/admin-accommodation.dto';

export class AdminAccommodationsRepository {
  public async findMany(query: AdminAccommodationFilterQuery): Promise<{
    items: Accommodation[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const order = query.sortOrder || query.sort_order || query.order || 'desc';

    const minRating = query.minRating ?? query.min_rating;
    const minPrice = query.minPrice ?? query.min_price;
    const maxPrice = query.maxPrice ?? query.max_price;
    const isFeatured = query.isFeatured;
    const typeFilter = query.type || query.category;
    const facilityFilter = query.facility || query.facilities || query.amenity;

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
        parsedEndDate.setHours(23, 59, 59, 999);
      }
      createdAtFilter.lte = parsedEndDate;
    }

    const where: Prisma.AccommodationWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status && { status: query.status }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(query.region && { region: query.region }),
      ...(typeFilter && {
        type: { contains: typeFilter, mode: 'insensitive' },
      }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(minPrice !== undefined && { pricePerNight: { gte: minPrice } }),
      ...(maxPrice !== undefined && { pricePerNight: { lte: maxPrice } }),
      ...(facilityFilter && {
        amenities: { contains: facilityFilter, mode: 'insensitive' },
      }),
      ...(Object.keys(createdAtFilter).length > 0 && { createdAt: createdAtFilter }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { description: { contains: query.search.trim(), mode: 'insensitive' } },
          { type: { contains: query.search.trim(), mode: 'insensitive' } },
          { address: { contains: query.search.trim(), mode: 'insensitive' } },
          { amenities: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.accommodation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
      }),
      prisma.accommodation.count({ where }),
    ]);

    return { items, total };
  }

  public async findByIdOrSlug(
    idOrSlug: string,
    includeDeleted = false,
  ): Promise<Accommodation | null> {
    return prisma.accommodation.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findBySlug(slug: string): Promise<Accommodation | null> {
    return prisma.accommodation.findUnique({
      where: { slug },
    });
  }

  public async findByName(name: string): Promise<Accommodation | null> {
    return prisma.accommodation.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
  }

  public async create(data: Prisma.AccommodationCreateInput): Promise<Accommodation> {
    return prisma.accommodation.create({
      data,
    });
  }

  public async update(id: string, data: Prisma.AccommodationUpdateInput): Promise<Accommodation> {
    return prisma.accommodation.update({
      where: { id },
      data,
    });
  }

  public async softDelete(id: string): Promise<Accommodation> {
    return prisma.accommodation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });
  }

  public async hardDelete(id: string): Promise<Accommodation> {
    return prisma.accommodation.delete({
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

export const adminAccommodationsRepository = new AdminAccommodationsRepository();
