import { DestinationImage } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../../common/errors/app-error';
import {
  AdminDestinationImagesRepository,
  adminDestinationImagesRepository,
} from './admin-destination-images.repository';
import {
  CreateDestinationImageDto,
  DestinationImageDto,
  UpdateDestinationImageDto,
} from './dto/admin-destination-image.dto';
import { destinationsService } from '../../destinations/destinations.service';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';

export class AdminDestinationImagesService {
  constructor(
    private readonly repository: AdminDestinationImagesRepository = adminDestinationImagesRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  private mapToDto(image: DestinationImage): DestinationImageDto {
    return {
      id: image.id,
      destinationId: image.destinationId,
      imageUrl: image.imageUrl,
      imagePublicId: (image as any).imagePublicId || null,
      caption: image.caption,
      altText: image.altText,
      orderIndex: image.orderIndex,
      isPrimary: image.isPrimary,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  public async getDestinationImages(destinationIdOrSlug: string): Promise<DestinationImageDto[]> {
    const destination = await this.repository.findDestinationByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const images = await this.repository.findByDestinationId(destination.id);
    return images.map((img) => this.mapToDto(img));
  }

  public async createDestinationImage(
    destinationIdOrSlug: string,
    dto: CreateDestinationImageDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DestinationImageDto> {
    const destination = await this.repository.findDestinationByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    // 1. Resolve Image URL & Public ID
    let imageUrl = dto.secureUrl || dto.imageUrl;
    let imagePublicId = dto.publicId;

    if (dto.image) {
      if (typeof dto.image === 'object' && dto.image !== null) {
        imageUrl = dto.image.secureUrl || imageUrl;
        imagePublicId = dto.image.publicId || imagePublicId;
      } else if (typeof dto.image === 'string' && dto.image.trim().length > 0) {
        imageUrl = dto.image.trim();
      }
    }

    if (!imageUrl) {
      throw new BadRequestError(
        'An image asset (publicId & secureUrl) or valid imageUrl is required',
        'IMAGE_REQUIRED',
      );
    }

    // 2. Validate asset ownership if publicId is provided
    if (imagePublicId && adminUserId) {
      this.cloudinary.validateAdminAssetOwnership(imagePublicId, adminUserId, 'DESTINATION');
    }

    // 3. Determine orderIndex
    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : dto.sortOrder !== undefined
          ? dto.sortOrder
          : (await this.repository.getMaxOrderIndex(destination.id)) + 1;

    const isPrimary = dto.isPrimary === true;

    try {
      // 4. Primary image handling
      if (isPrimary) {
        await this.repository.clearPrimaryImages(destination.id);
        await this.repository.setDestinationCoverImage(destination.id, imageUrl);
      }

      // 5. Create image record
      const created = await this.repository.create({
        destination: { connect: { id: destination.id } },
        imageUrl,
        imagePublicId: imagePublicId || null,
        caption: dto.caption || null,
        altText: dto.altText || null,
        orderIndex,
        isPrimary,
      });

      // Invalidate public destinations cache
      destinationsService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_DESTINATION_IMAGE',
        entity: 'DestinationImage',
        entityId: created.id,
        details: JSON.stringify({
          destinationId: destination.id,
          imageUrl,
          imagePublicId,
          isPrimary,
        }),
        ipAddress,
        userAgent,
      });

      return this.mapToDto(created);
    } catch (error) {
      // Rollback newly uploaded asset if DB transaction/creation failed
      if (imagePublicId) {
        logger.warn(
          { imagePublicId, error },
          'Rolling back Cloudinary asset due to DB creation failure',
        );
        await this.cloudinary.deleteAsset(imagePublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async updateDestinationImage(
    destinationIdOrSlug: string,
    imageId: string,
    dto: UpdateDestinationImageDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DestinationImageDto> {
    const destination = await this.repository.findDestinationByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const image = await this.repository.findById(imageId);
    if (!image || image.destinationId !== destination.id) {
      throw new NotFoundError(
        `Image with ID '${imageId}' not found for destination '${destination.name}'`,
        'DESTINATION_IMAGE_NOT_FOUND',
      );
    }

    // 1. Resolve new asset fields
    let incomingPublicId = dto.publicId;
    let incomingUrl = dto.secureUrl || dto.imageUrl;

    if (dto.image) {
      if (typeof dto.image === 'object' && dto.image !== null) {
        incomingUrl = dto.image.secureUrl || incomingUrl;
        incomingPublicId = dto.image.publicId || incomingPublicId;
      } else if (typeof dto.image === 'string' && dto.image.trim().length > 0) {
        incomingUrl = dto.image.trim();
      }
    }

    const newPublicId = incomingPublicId;
    const isImageUnchanged = Boolean(
      (image.imagePublicId && image.imagePublicId === newPublicId) ||
      (image.imageUrl && image.imageUrl === incomingUrl),
    );
    const isNewAsset = Boolean(newPublicId && !isImageUnchanged);

    if (isNewAsset && newPublicId && adminUserId) {
      this.cloudinary.validateAdminAssetOwnership(newPublicId, adminUserId, 'DESTINATION');
    }

    const imageUrl = incomingUrl || image.imageUrl;
    const imagePublicId = incomingPublicId !== undefined ? incomingPublicId : image.imagePublicId;

    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : dto.sortOrder !== undefined
          ? dto.sortOrder
          : image.orderIndex;

    const isPrimary = dto.isPrimary !== undefined ? dto.isPrimary : image.isPrimary;

    try {
      // 2. Primary image handling
      if (isPrimary && !image.isPrimary) {
        await this.repository.clearPrimaryImages(destination.id, image.id);
        await this.repository.setDestinationCoverImage(destination.id, imageUrl);
      }

      // 3. Update image
      const updated = await this.repository.update(image.id, {
        imageUrl,
        imagePublicId: imagePublicId || null,
        caption: dto.caption !== undefined ? dto.caption : image.caption,
        altText: dto.altText !== undefined ? dto.altText : image.altText,
        orderIndex,
        isPrimary,
      });

      // 4. Clean up old asset post-commit if replaced
      if (isNewAsset && image.imagePublicId) {
        this.cloudinary.deleteAsset(image.imagePublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: image.imagePublicId },
            'Failed to delete replaced old asset',
          );
        });
      }

      // Invalidate public destinations cache
      destinationsService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_DESTINATION_IMAGE',
        entity: 'DestinationImage',
        entityId: updated.id,
        details: JSON.stringify({
          destinationId: destination.id,
          imageUrl,
          imagePublicId,
          isPrimary,
        }),
        ipAddress,
        userAgent,
      });

      return this.mapToDto(updated);
    } catch (error) {
      // Rollback new asset if DB update failed
      if (isNewAsset && newPublicId) {
        await this.cloudinary.deleteAsset(newPublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async deleteDestinationImage(
    destinationIdOrSlug: string,
    imageId: string,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const destination = await this.repository.findDestinationByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const image = await this.repository.findById(imageId);
    if (!image || image.destinationId !== destination.id) {
      throw new NotFoundError(
        `Image with ID '${imageId}' not found for destination '${destination.name}'`,
        'DESTINATION_IMAGE_NOT_FOUND',
      );
    }

    // Delete image from database
    await this.repository.delete(image.id);

    // Delete asset from Cloudinary storage post-commit
    if (image.imagePublicId) {
      this.cloudinary.deleteAsset(image.imagePublicId).catch((err) => {
        logger.warn(
          { err, publicId: image.imagePublicId },
          'Failed to delete asset from Cloudinary',
        );
      });
    }

    // Invalidate cache
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'DELETE_DESTINATION_IMAGE',
      entity: 'DestinationImage',
      entityId: image.id,
      details: JSON.stringify({
        destinationId: destination.id,
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
      }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminDestinationImagesService = new AdminDestinationImagesService();
