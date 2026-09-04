import { Accommodation, DestinationStatus } from '@prisma/client';
import {
  adminAccommodationsRepository,
  AdminAccommodationsRepository,
} from './admin-accommodations.repository';
import {
  AdminAccommodationDto,
  AdminAccommodationFilterQuery,
  CreateAccommodationDto,
  UpdateAccommodationDto,
} from './dto/admin-accommodation.dto';
import { BadRequestError, ConflictError, NotFoundError } from '../../../common/errors/app-error';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';
import { CloudinaryAssetInput } from '../uploads/dto/admin-uploads.dto';

export class AdminAccommodationsService {
  constructor(
    private readonly repository: AdminAccommodationsRepository = adminAccommodationsRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public mapToDto = (accommodation: Accommodation): AdminAccommodationDto => {
    let parsedImages: string[] = [];
    if (accommodation.images) {
      try {
        parsedImages = JSON.parse(accommodation.images);
      } catch {
        parsedImages = [];
      }
    }

    let parsedAmenities: string[] = [];
    if (accommodation.amenities) {
      try {
        parsedAmenities = JSON.parse(accommodation.amenities);
      } catch {
        parsedAmenities = [];
      }
    }

    return {
      id: accommodation.id,
      name: accommodation.name,
      slug: accommodation.slug,
      type: accommodation.type,
      description: accommodation.description,
      rating: accommodation.rating,
      reviewCount: accommodation.reviewCount,
      pricePerNight: Number(accommodation.pricePerNight),
      currency: accommodation.currency,
      address: accommodation.address,
      region: accommodation.region,
      latitude: accommodation.latitude,
      longitude: accommodation.longitude,
      coverImageUrl: accommodation.coverImageUrl,
      coverImagePublicId: accommodation.coverImagePublicId,
      images: parsedImages,
      facilities: parsedAmenities,
      amenities: parsedAmenities,
      contactPhone: accommodation.contactPhone,
      websiteUrl: accommodation.websiteUrl,
      status: accommodation.status,
      isFeatured: accommodation.isFeatured,
      createdAt: accommodation.createdAt,
      updatedAt: accommodation.updatedAt,
      deletedAt: accommodation.deletedAt,
    };
  };

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  public async getAccommodations(query: AdminAccommodationFilterQuery) {
    const { items, total } = await this.repository.findMany(query);
    const limit = query.limit || 10;
    const page = query.page || 1;

    return {
      data: items.map(this.mapToDto),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getAccommodationById(idOrSlug: string): Promise<AdminAccommodationDto> {
    const accommodation = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!accommodation) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }
    return this.mapToDto(accommodation);
  }

  public async createAccommodation(
    dto: CreateAccommodationDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminAccommodationDto> {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    // 1. Check slug uniqueness
    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictError(
        `Accommodation with slug '${slug}' already exists`,
        'ACCOMMODATION_SLUG_EXISTS',
      );
    }

    // 2. Resolve cover image & public ID
    let coverImageUrl = dto.coverImageUrl || '';
    let coverImagePublicId: string | null = null;
    const newPublicIds: string[] = [];

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrl = dto.coverImage.secureUrl;
      coverImagePublicId = dto.coverImage.publicId;
      if (adminUserId && coverImagePublicId) {
        this.cloudinary.validateAdminAssetOwnership(
          coverImagePublicId,
          adminUserId,
          'ACCOMMODATION',
        );
        newPublicIds.push(coverImagePublicId);
      }
    }

    if (!coverImageUrl) {
      throw new BadRequestError('Cover image is required', 'COVER_IMAGE_REQUIRED');
    }

    // 3. Resolve gallery images
    const imagesList: string[] = [];
    if (Array.isArray(dto.images) && dto.images.length > 0) {
      dto.images.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          const asset = item as CloudinaryAssetInput;
          if (asset.publicId) {
            if (adminUserId) {
              this.cloudinary.validateAdminAssetOwnership(
                asset.publicId,
                adminUserId,
                'ACCOMMODATION',
              );
            }
            newPublicIds.push(asset.publicId);
          }
          imagesList.push(asset.secureUrl);
        } else if (typeof item === 'string' && item.trim().length > 0) {
          imagesList.push(item.trim());
        }
      });
    }

    const amenitiesList = dto.facilities || dto.amenities || [];

    try {
      // 4. Create accommodation
      const created = await this.repository.create({
        name: dto.name,
        slug,
        type: dto.type,
        description: dto.description,
        pricePerNight: dto.pricePerNight,
        currency: dto.currency || 'IDR',
        address: dto.address,
        region: dto.region,
        latitude: dto.latitude,
        longitude: dto.longitude,
        coverImageUrl,
        coverImagePublicId,
        images: JSON.stringify(imagesList),
        amenities: JSON.stringify(amenitiesList),
        contactPhone: dto.contactPhone || null,
        websiteUrl: dto.websiteUrl || null,
        status: dto.status,
        isFeatured: dto.isFeatured,
      });

      // 5. Audit log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_ACCOMMODATION',
        entity: 'Accommodation',
        entityId: created.id,
        details: JSON.stringify({ name: created.name, slug: created.slug }),
        ipAddress,
        userAgent,
      });

      return this.mapToDto(created);
    } catch (error) {
      if (newPublicIds.length > 0) {
        logger.warn(
          { newPublicIds, error },
          'Rolling back Cloudinary assets due to Accommodation create failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateAccommodation(
    idOrSlug: string,
    dto: UpdateAccommodationDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminAccommodationDto> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }

    let slug = existing.slug;
    if (dto.slug) {
      slug = this.slugify(dto.slug);
    } else if (dto.name && dto.name !== existing.name && !dto.slug) {
      slug = this.slugify(dto.name);
    }

    // Check slug collision if changed
    if (slug !== existing.slug) {
      const collision = await this.repository.findBySlug(slug);
      if (collision && collision.id !== existing.id) {
        throw new ConflictError(
          `Accommodation with slug '${slug}' already exists`,
          'ACCOMMODATION_SLUG_EXISTS',
        );
      }
    }

    // Resolve cover image & public ID
    let coverImageUrlToUpdate: string | undefined = undefined;
    let coverImagePublicIdToUpdate: string | null | undefined = undefined;
    const newPublicIds: string[] = [];

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrlToUpdate = dto.coverImage.secureUrl;
      coverImagePublicIdToUpdate = dto.coverImage.publicId;
      if (
        adminUserId &&
        coverImagePublicIdToUpdate &&
        coverImagePublicIdToUpdate !== existing.coverImagePublicId
      ) {
        this.cloudinary.validateAdminAssetOwnership(
          coverImagePublicIdToUpdate,
          adminUserId,
          'ACCOMMODATION',
        );
        newPublicIds.push(coverImagePublicIdToUpdate);
      }
    } else if (dto.coverImageUrl !== undefined) {
      coverImageUrlToUpdate = dto.coverImageUrl;
    }

    // Resolve gallery images
    let imagesJsonToUpdate: string | undefined = undefined;
    if (Array.isArray(dto.images)) {
      const imagesList: string[] = [];
      dto.images.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          const asset = item as CloudinaryAssetInput;
          if (asset.publicId) {
            if (adminUserId && !existing.images?.includes(asset.secureUrl)) {
              this.cloudinary.validateAdminAssetOwnership(
                asset.publicId,
                adminUserId,
                'ACCOMMODATION',
              );
              newPublicIds.push(asset.publicId);
            }
          }
          imagesList.push(asset.secureUrl);
        } else if (typeof item === 'string' && item.trim().length > 0) {
          imagesList.push(item.trim());
        }
      });
      imagesJsonToUpdate = JSON.stringify(imagesList);
    }

    const amenitiesList = dto.facilities || dto.amenities;

    try {
      const updated = await this.repository.update(existing.id, {
        ...(dto.name && { name: dto.name }),
        ...(slug && { slug }),
        ...(dto.type && { type: dto.type }),
        ...(dto.description && { description: dto.description }),
        ...(dto.pricePerNight !== undefined && { pricePerNight: dto.pricePerNight }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.address && { address: dto.address }),
        ...(dto.region && { region: dto.region }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(coverImageUrlToUpdate !== undefined && { coverImageUrl: coverImageUrlToUpdate }),
        ...(coverImagePublicIdToUpdate !== undefined && {
          coverImagePublicId: coverImagePublicIdToUpdate,
        }),
        ...(imagesJsonToUpdate !== undefined && { images: imagesJsonToUpdate }),
        ...(amenitiesList && { amenities: JSON.stringify(amenitiesList) }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
        ...(dto.status && { status: dto.status }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      });

      // Post-commit cleanup of old cover asset if replaced
      if (
        coverImagePublicIdToUpdate &&
        existing.coverImagePublicId &&
        existing.coverImagePublicId !== coverImagePublicIdToUpdate
      ) {
        this.cloudinary.deleteAsset(existing.coverImagePublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: existing.coverImagePublicId },
            'Failed to delete replaced accommodation cover asset',
          );
        });
      }

      // Audit log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_ACCOMMODATION',
        entity: 'Accommodation',
        entityId: updated.id,
        details: JSON.stringify({ changes: dto }),
        ipAddress,
        userAgent,
      });

      return this.mapToDto(updated);
    } catch (error) {
      if (newPublicIds.length > 0) {
        logger.warn(
          { newPublicIds, error },
          'Rolling back Cloudinary assets due to Accommodation update failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateAccommodationStatus(
    idOrSlug: string,
    status: DestinationStatus,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminAccommodationDto> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }

    const updated = await this.repository.update(existing.id, {
      status,
      deletedAt: status === 'ARCHIVED' ? new Date() : null,
    });

    // Audit log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'UPDATE_ACCOMMODATION_STATUS',
      entity: 'Accommodation',
      entityId: updated.id,
      details: JSON.stringify({ previousStatus: existing.status, newStatus: status }),
      ipAddress,
      userAgent,
    });

    return this.mapToDto(updated);
  }

  public async deleteAccommodation(
    idOrSlug: string,
    hard = false,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }

    if (hard) {
      await this.repository.hardDelete(existing.id);
      if (existing.coverImagePublicId) {
        this.cloudinary.deleteAsset(existing.coverImagePublicId).catch(() => {});
      }
    } else {
      await this.repository.softDelete(existing.id);
    }

    // Audit log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: hard ? 'HARD_DELETE_ACCOMMODATION' : 'SOFT_DELETE_ACCOMMODATION',
      entity: 'Accommodation',
      entityId: existing.id,
      details: JSON.stringify({ name: existing.name, hard }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminAccommodationsService = new AdminAccommodationsService();
