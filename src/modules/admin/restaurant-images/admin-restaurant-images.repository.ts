import { Prisma, RestaurantImage } from '@prisma/client';
import { prisma } from '../../../database/prisma';

export class AdminRestaurantImagesRepository {
  public async findByRestaurantId(restaurantId: string): Promise<RestaurantImage[]> {
    return prisma.restaurantImage.findMany({
      where: { restaurantId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  public async findById(imageId: string): Promise<RestaurantImage | null> {
    return prisma.restaurantImage.findUnique({
      where: { id: imageId },
      include: {
        restaurant: true,
      },
    });
  }

  public async findRestaurantByIdOrSlug(idOrSlug: string) {
    return prisma.restaurant.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  }

  public async getMaxOrderIndex(restaurantId: string): Promise<number> {
    const highest = await prisma.restaurantImage.findFirst({
      where: { restaurantId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return highest?.orderIndex ?? -1;
  }

  public async create(data: Prisma.RestaurantImageCreateInput): Promise<RestaurantImage> {
    return prisma.restaurantImage.create({
      data,
    });
  }

  public async update(
    imageId: string,
    data: Prisma.RestaurantImageUpdateInput,
  ): Promise<RestaurantImage> {
    return prisma.restaurantImage.update({
      where: { id: imageId },
      data,
    });
  }

  public async clearPrimaryImages(restaurantId: string, excludeImageId?: string): Promise<void> {
    await prisma.restaurantImage.updateMany({
      where: {
        restaurantId,
        ...(excludeImageId && { id: { not: excludeImageId } }),
      },
      data: {
        isPrimary: false,
      },
    });
  }

  public async setRestaurantCoverImage(restaurantId: string, imageUrl: string): Promise<void> {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        coverImageUrl: imageUrl,
      },
    });
  }

  public async delete(imageId: string): Promise<RestaurantImage> {
    return prisma.restaurantImage.delete({
      where: { id: imageId },
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
      // Audit log error should not fail the primary transaction
    }
  }
}

export const adminRestaurantImagesRepository = new AdminRestaurantImagesRepository();
