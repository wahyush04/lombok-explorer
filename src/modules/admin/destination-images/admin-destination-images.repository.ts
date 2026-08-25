import { Prisma, DestinationImage } from '@prisma/client';
import { prisma } from '../../../database/prisma';

export class AdminDestinationImagesRepository {
  public async findByDestinationId(destinationId: string): Promise<DestinationImage[]> {
    return prisma.destinationImage.findMany({
      where: { destinationId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  public async findById(imageId: string): Promise<DestinationImage | null> {
    return prisma.destinationImage.findUnique({
      where: { id: imageId },
      include: {
        destination: true,
      },
    });
  }

  public async findDestinationByIdOrSlug(idOrSlug: string) {
    return prisma.destination.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  }

  public async getMaxOrderIndex(destinationId: string): Promise<number> {
    const highest = await prisma.destinationImage.findFirst({
      where: { destinationId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return highest?.orderIndex ?? -1;
  }

  public async create(data: Prisma.DestinationImageCreateInput): Promise<DestinationImage> {
    return prisma.destinationImage.create({
      data,
    });
  }

  public async update(
    imageId: string,
    data: Prisma.DestinationImageUpdateInput,
  ): Promise<DestinationImage> {
    return prisma.destinationImage.update({
      where: { id: imageId },
      data,
    });
  }

  public async clearPrimaryImages(destinationId: string, excludeImageId?: string): Promise<void> {
    await prisma.destinationImage.updateMany({
      where: {
        destinationId,
        ...(excludeImageId && { id: { not: excludeImageId } }),
      },
      data: {
        isPrimary: false,
      },
    });
  }

  public async setDestinationCoverImage(destinationId: string, imageUrl: string): Promise<void> {
    await prisma.destination.update({
      where: { id: destinationId },
      data: {
        coverImageUrl: imageUrl,
      },
    });
  }

  public async delete(imageId: string): Promise<DestinationImage> {
    return prisma.destinationImage.delete({
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

export const adminDestinationImagesRepository = new AdminDestinationImagesRepository();
