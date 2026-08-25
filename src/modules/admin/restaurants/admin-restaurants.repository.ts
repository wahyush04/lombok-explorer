import { Prisma, Restaurant } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminRestaurantFilterQuery } from './dto/admin-restaurant.dto';

export class AdminRestaurantsRepository {
  public async findMany(query: AdminRestaurantFilterQuery): Promise<{
    items: Restaurant[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'createdAt';
    const order = query.order || 'desc';

    const minRating = query.minRating ?? query.min_rating;
    const minPrice = query.minPrice ?? query.min_price;
    const maxPrice = query.maxPrice ?? query.max_price;
    const isFeatured = query.isFeatured;
    const isHalalCertified = query.isHalalCertified;
    const cuisineFilter = query.cuisineType || query.cuisine || query.category;

    const where: Prisma.RestaurantWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status && { status: query.status }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(isHalalCertified !== undefined && { isHalalCertified }),
      ...(query.region && { region: query.region }),
      ...(query.priceRange && { priceRange: query.priceRange }),
      ...(minRating !== undefined && { rating: { gte: minRating } }),
      ...(minPrice !== undefined && { minPrice: { gte: minPrice } }),
      ...(maxPrice !== undefined && { maxPrice: { lte: maxPrice } }),
      ...(cuisineFilter && {
        cuisineType: { contains: cuisineFilter, mode: 'insensitive' },
      }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { specialtyDish: { contains: query.search, mode: 'insensitive' } },
          { cuisineType: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { address: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
      }),
      prisma.restaurant.count({ where }),
    ]);

    return { items, total };
  }

  public async findByIdOrSlug(
    idOrSlug: string,
    includeDeleted = false,
  ): Promise<Restaurant | null> {
    return prisma.restaurant.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findBySlug(slug: string): Promise<Restaurant | null> {
    return prisma.restaurant.findUnique({
      where: { slug },
    });
  }

  public async findByName(name: string): Promise<Restaurant | null> {
    return prisma.restaurant.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
  }

  public async create(data: Prisma.RestaurantCreateInput): Promise<Restaurant> {
    return prisma.restaurant.create({
      data,
    });
  }

  public async update(id: string, data: Prisma.RestaurantUpdateInput): Promise<Restaurant> {
    return prisma.restaurant.update({
      where: { id },
      data,
    });
  }

  public async softDelete(id: string): Promise<Restaurant> {
    return prisma.restaurant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });
  }

  public async hardDelete(id: string): Promise<Restaurant> {
    return prisma.restaurant.delete({
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

export const adminRestaurantsRepository = new AdminRestaurantsRepository();
