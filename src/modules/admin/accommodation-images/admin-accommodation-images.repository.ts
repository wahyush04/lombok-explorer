import { Prisma, AccommodationImage } from '@prisma/client';
import { prisma } from '../../../database/prisma';

export class AdminAccommodationImagesRepository {
  public async findByAccommodationId(accommodationId: string): Promise<AccommodationImage[]> {
    return prisma.accommodationImage.findMany({
      where: { accommodationId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  public async findById(imageId: string): Promise<AccommodationImage | null> {
    return prisma.accommodationImage.findUnique({
      where: { id: imageId },
      include: {
        accommodation: true,
      },
    });
  }

  public async findAccommodationByIdOrSlug(idOrSlug: string) {
    return prisma.accommodation.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  }

  public async getMaxOrderIndex(accommodationId: string): Promise<number> {
    const highest = await prisma.accommodationImage.findFirst({
      where: { accommodationId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return highest?.orderIndex ?? -1;
  }

  public async create(data: Prisma.AccommodationImageCreateInput): Promise<AccommodationImage> {
    return prisma.accommodationImage.create({
      data,
    });
  }

  public async update(
    imageId: string,
    data: Prisma.AccommodationImageUpdateInput,
  ): Promise<AccommodationImage> {
    return prisma.accommodationImage.update({
      where: { id: imageId },
      data,
    });
  }

  public async clearPrimaryImages(accommodationId: string, excludeImageId?: string): Promise<void> {
    await prisma.accommodationImage.updateMany({
      where: {
        accommodationId,
        ...(excludeImageId && { id: { not: excludeImageId } }),
      },
      data: {
        isPrimary: false,
      },
    });
  }

  public async setAccommodationCoverImage(accommodationId: string, imageUrl: string): Promise<void> {
    await prisma.accommodation.update({
      where: { id: accommodationId },
      data: {
        coverImageUrl: imageUrl,
      },
    });
  }

  public async delete(imageId: string): Promise<AccommodationImage> {
    return prisma.accommodationImage.delete({
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

export const adminAccommodationImagesRepository = new AdminAccommodationImagesRepository();
