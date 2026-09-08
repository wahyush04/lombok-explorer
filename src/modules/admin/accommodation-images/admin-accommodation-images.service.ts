import { AccommodationImage } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../../common/errors/app-error';
import {
  AdminAccommodationImagesRepository,
  adminAccommodationImagesRepository,
} from './admin-accommodation-images.repository';
import {
  CreateAccommodationImageDto,
  AccommodationImageDto,
  UpdateAccommodationImageDto,
} from './dto/admin-accommodation-image.dto';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';

export class AdminAccommodationImagesService {
  constructor(
    private readonly repository: AdminAccommodationImagesRepository = adminAccommodationImagesRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  private mapToDto(image: AccommodationImage): AccommodationImageDto {
    return {
      id: image.id,
      accommodationId: image.accommodationId,
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

  public async getAccommodationImages(accommodationIdOrSlug: string): Promise<AccommodationImageDto[]> {
    const accommodation = await this.repository.findAccommodationByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const images = await this.repository.findByAccommodationId(accommodation.id);
    return images.map((img) => this.mapToDto(img));
  }

  public async createAccommodationImage(
    accommodationIdOrSlug: string,
    dto: CreateAccommodationImageDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AccommodationImageDto> {
    const accommodation = await this.repository.findAccommodationByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
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
      this.cloudinary.validateAdminAssetOwnership(imagePublicId, adminUserId, 'ACCOMMODATION');
    }

    // 3. Determine orderIndex
    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : dto.sortOrder !== undefined
          ? dto.sortOrder
          : (await this.repository.getMaxOrderIndex(accommodation.id)) + 1;

    const isPrimary = dto.isPrimary === true;

    try {
      // 4. Primary image handling
      if (isPrimary) {
        await this.repository.clearPrimaryImages(accommodation.id);
        await this.repository.setAccommodationCoverImage(accommodation.id, imageUrl);
      }

      // 5. Create image record
      const created = await this.repository.create({
        accommodation: { connect: { id: accommodation.id } },
        imageUrl,
        imagePublicId: imagePublicId || null,
        caption: dto.caption || null,
        altText: dto.altText || null,
        orderIndex,
        isPrimary,
      });

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_ACCOMMODATION_IMAGE',
        entity: 'AccommodationImage',
        entityId: created.id,
        details: JSON.stringify({
          accommodationId: accommodation.id,
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

  public async updateAccommodationImage(
    accommodationIdOrSlug: string,
    imageId: string,
    dto: UpdateAccommodationImageDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AccommodationImageDto> {
    const accommodation = await this.repository.findAccommodationByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const image = await this.repository.findById(imageId);
    if (!image || image.accommodationId !== accommodation.id) {
      throw new NotFoundError(
        `Image with ID '${imageId}' not found for accommodation '${accommodation.name}'`,
        'ACCOMMODATION_IMAGE_NOT_FOUND',
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
      this.cloudinary.validateAdminAssetOwnership(newPublicId, adminUserId, 'ACCOMMODATION');
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
        await this.repository.clearPrimaryImages(accommodation.id, image.id);
        await this.repository.setAccommodationCoverImage(accommodation.id, imageUrl);
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

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_ACCOMMODATION_IMAGE',
        entity: 'AccommodationImage',
        entityId: updated.id,
        details: JSON.stringify({
          accommodationId: accommodation.id,
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

  public async deleteAccommodationImage(
    accommodationIdOrSlug: string,
    imageId: string,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const accommodation = await this.repository.findAccommodationByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const image = await this.repository.findById(imageId);
    if (!image || image.accommodationId !== accommodation.id) {
      throw new NotFoundError(
        `Image with ID '${imageId}' not found for accommodation '${accommodation.name}'`,
        'ACCOMMODATION_IMAGE_NOT_FOUND',
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

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'DELETE_ACCOMMODATION_IMAGE',
      entity: 'AccommodationImage',
      entityId: image.id,
      details: JSON.stringify({
        accommodationId: accommodation.id,
        imageUrl: image.imageUrl,
        imagePublicId: image.imagePublicId,
      }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminAccommodationImagesService = new AdminAccommodationImagesService();
