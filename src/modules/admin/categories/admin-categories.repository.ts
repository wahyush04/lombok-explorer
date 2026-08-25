import { Prisma, Category } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AdminCategoryFilterQuery } from './dto/admin-category.dto';

export type CategoryWithDestinationsCount = Category & {
  _count?: {
    destinations: number;
  };
};

export class AdminCategoriesRepository {
  public async findMany(query: AdminCategoryFilterQuery): Promise<{
    items: CategoryWithDestinationsCount[];
    total: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || query.sort_by || 'name';
    const order = query.order || 'asc';

    const where: Prisma.CategoryWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
          { slug: { contains: query.search } },
        ],
      }),
    };

    const orderBy: Prisma.CategoryOrderByWithRelationInput =
      sortBy === 'destinationsCount' ? { destinations: { _count: order } } : { [sortBy]: order };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              destinations: true,
            },
          },
        },
      }),
      prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  public async findByIdOrSlug(
    idOrSlug: string,
    includeDeleted = true,
  ): Promise<CategoryWithDestinationsCount | null> {
    const where: Prisma.CategoryWhereInput = {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      ...(!includeDeleted && { deletedAt: null }),
    };

    return prisma.category.findFirst({
      where,
      include: {
        _count: {
          select: {
            destinations: true,
          },
        },
      },
    });
  }

  public async findByName(name: string): Promise<Category | null> {
    return prisma.category.findFirst({
      where: {
        name: {
          equals: name,
        },
      },
    });
  }

  public async findBySlug(slug: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { slug },
    });
  }

  public async countDestinations(categoryId: string): Promise<number> {
    return prisma.destination.count({
      where: { categoryId },
    });
  }

  public async create(data: Prisma.CategoryCreateInput): Promise<CategoryWithDestinationsCount> {
    return prisma.category.create({
      data,
      include: {
        _count: {
          select: {
            destinations: true,
          },
        },
      },
    });
  }

  public async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
  ): Promise<CategoryWithDestinationsCount> {
    return prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: {
            destinations: true,
          },
        },
      },
    });
  }

  public async reassignDestinations(
    oldCategoryId: string,
    newCategoryId: string,
  ): Promise<Prisma.BatchPayload> {
    return prisma.destination.updateMany({
      where: { categoryId: oldCategoryId },
      data: { categoryId: newCategoryId },
    });
  }

  public async softDelete(id: string): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date(),
      },
    });
  }

  public async hardDelete(id: string): Promise<Category> {
    return prisma.category.delete({
      where: { id },
    });
  }

  public async delete(id: string): Promise<Category> {
    return prisma.category.delete({
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
      // Audit logging failures should not interrupt business flow
    }
  }
}

export const adminCategoriesRepository = new AdminCategoriesRepository();
