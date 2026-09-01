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
import { storageService, StorageService } from '../../storage/storage.service';
import { UploadFileInput } from '../../storage/providers';

export class AdminDestinationImagesService {
  constructor(
    private readonly repository: AdminDestinationImagesRepository = adminDestinationImagesRepository,
    private readonly storage: StorageService = storageService,
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
    file?: UploadFileInput,
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

    // 1. Resolve Image URL (uploaded file or URL string)
    let imageUrl = dto.imageUrl;
    let imagePublicId: string | undefined;

    if (file && file.buffer && file.buffer.length > 0) {
      const stored = await this.storage.uploadImage(file, {
        type: 'DESTINATION',
        entityId: destination.id,
      });
      imageUrl = stored.secureUrl || stored.url;
      imagePublicId = stored.publicId;
    }

    if (!imageUrl) {
      throw new BadRequestError('An image file or a valid imageUrl is required', 'IMAGE_REQUIRED');
    }

    // 2. Determine orderIndex
    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : dto.sortOrder !== undefined
          ? dto.sortOrder
          : (await this.repository.getMaxOrderIndex(destination.id)) + 1;

    const isPrimary = dto.isPrimary === true;

    // 3. Primary image handling
    if (isPrimary) {
      await this.repository.clearPrimaryImages(destination.id);
      await this.repository.setDestinationCoverImage(destination.id, imageUrl);
    }

    // 4. Create image record
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
  }

  public async updateDestinationImage(
    destinationIdOrSlug: string,
    imageId: string,
    dto: UpdateDestinationImageDto,
    file?: UploadFileInput,
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

    // 1. Check if new file uploaded
    let imageUrl = image.imageUrl;
    let imagePublicId = image.imagePublicId;

    if (file && file.buffer && file.buffer.length > 0) {
      const oldPublicId = image.imagePublicId || image.imageUrl;
      const stored = await this.storage.replaceImage(oldPublicId, file, {
        type: 'DESTINATION',
        entityId: destination.id,
      });
      imageUrl = stored.secureUrl || stored.url;
      imagePublicId = stored.publicId;
    } else if (dto.imageUrl) {
      imageUrl = dto.imageUrl;
    }

    const orderIndex =
      dto.orderIndex !== undefined
        ? dto.orderIndex
        : dto.sortOrder !== undefined
          ? dto.sortOrder
          : image.orderIndex;

    const isPrimary = dto.isPrimary !== undefined ? dto.isPrimary : image.isPrimary;

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

    // Delete asset from Cloudinary storage if available
    const assetToDelete = image.imagePublicId || image.imageUrl;
    if (assetToDelete) {
      this.storage.deleteImage(assetToDelete).catch(() => {});
    }

    // Delete image from database
    await this.repository.delete(image.id);

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
