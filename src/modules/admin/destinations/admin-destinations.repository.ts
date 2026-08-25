import { Prisma, Destination, Category, DestinationImage } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminDestinationFilterQuery } from './dto/admin-destination.dto';

export type AdminDestinationWithRelations = Destination & {
  category?: Category | null;
  images?: DestinationImage[];
  _count?: {
    reviews: number;
    favorites: number;
  };
};

export class AdminDestinationsRepository {
  public async findMany(query: AdminDestinationFilterQuery): Promise<{
    items: AdminDestinationWithRelations[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const sortField = sortBy === 'ticketPrice' ? 'entranceFee' : sortBy;
    const order = query.order || 'desc';

    const minRating = query.minRating ?? query.min_rating;
    const minPrice = query.minPrice ?? query.min_price;
    const maxPrice = query.maxPrice ?? query.max_price;
    const isFeatured = query.isFeatured ?? query.is_featured;
    const categoryFilter = query.categoryId || query.category;

    const where: Prisma.DestinationWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status && { status: query.status }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(query.region && { region: query.region }),
      ...(query.difficulty && { difficulty: query.difficulty }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(minPrice !== undefined && { entranceFee: { gte: minPrice } }),
      ...(maxPrice !== undefined && { entranceFee: { lte: maxPrice } }),
      ...(categoryFilter && {
        OR: [{ categoryId: categoryFilter }, { category: { slug: categoryFilter.toLowerCase() } }],
      }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { locationName: { contains: query.search } },
          { description: { contains: query.search } },
          { shortDescription: { contains: query.search } },
          { address: { contains: query.search } },
          { tags: { contains: query.search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: order },
        include: {
          category: true,
          images: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: {
              reviews: true,
              favorites: true,
            },
          },
        },
      }),
      prisma.destination.count({ where }),
    ]);

    return { items, total };
  }

  public async findByIdOrSlug(
    idOrSlug: string,
    includeDeleted = false,
  ): Promise<AdminDestinationWithRelations | null> {
    return prisma.destination.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            reviews: true,
            favorites: true,
          },
        },
      },
    });
  }

  public async findBySlug(slug: string): Promise<Destination | null> {
    return prisma.destination.findUnique({
      where: { slug },
    });
  }

  public async create(data: Prisma.DestinationCreateInput): Promise<AdminDestinationWithRelations> {
    return prisma.destination.create({
      data,
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            reviews: true,
            favorites: true,
          },
        },
      },
    });
  }

  public async update(
    id: string,
    data: Prisma.DestinationUpdateInput,
  ): Promise<AdminDestinationWithRelations> {
    return prisma.destination.update({
      where: { id },
      data,
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: {
            reviews: true,
            favorites: true,
          },
        },
      },
    });
  }

  public async softDelete(id: string): Promise<Destination> {
    return prisma.destination.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });
  }

  public async hardDelete(id: string): Promise<Destination> {
    return prisma.destination.delete({
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
      // Audit log failures should not block core operations
    }
  }
}

export const adminDestinationsRepository = new AdminDestinationsRepository();
