import {
  adminDestinationsRepository,
  AdminDestinationsRepository,
  AdminDestinationWithRelations,
} from './admin-destinations.repository';
import { DestinationStatus } from '@prisma/client';
import {
  AdminDestinationFilterQuery,
  BulkDeleteDestinationsDto,
  BulkUpdateDestinationStatusDto,
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/admin-destination.dto';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error';
import { destinationsService } from '../../destinations/destinations.service';
import { prisma } from '../../../database/prisma';
import { PaginationMeta } from '../../../common/types';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';
import { CloudinaryAssetInput } from '../uploads/dto/admin-uploads.dto';

export class AdminDestinationsService {
  constructor(
    private readonly repository: AdminDestinationsRepository = adminDestinationsRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private parseJsonArray = (jsonString: string | null | undefined): string[] => {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return jsonString ? [jsonString] : [];
    }
  };

  public mapToAdminDto = (destination: AdminDestinationWithRelations) => {
    const imagesList: string[] = [];
    if (destination.coverImageUrl) {
      imagesList.push(destination.coverImageUrl);
    }
    if (Array.isArray(destination.images)) {
      destination.images.forEach((img) => {
        if (img && typeof img === 'object' && 'imageUrl' in img) {
          if (!imagesList.includes(img.imageUrl)) {
            imagesList.push(img.imageUrl);
          }
        }
      });
    }

    return {
      id: destination.id,
      slug: destination.slug,
      name: destination.name,
      shortDescription: destination.shortDescription,
      description: destination.description,
      categoryId: destination.categoryId,
      categoryName: destination.category?.name || '',
      categorySlug: destination.category?.slug || '',
      region: destination.region,
      locationName: destination.locationName,
      address: destination.address,
      latitude: destination.latitude,
      longitude: destination.longitude,
      rating: destination.rating,
      reviewCount: destination.reviewCount,
      entranceFee: Number(destination.entranceFee) || 0,
      ticketPrice: Number(destination.entranceFee) || 0,
      currency: destination.currency || 'IDR',
      openingHours: destination.openingHours,
      estimatedDurationMinutes: destination.estimatedDurationMinutes,
      estimatedDuration: destination.estimatedDurationMinutes,
      bestVisitingTime: destination.bestVisitingTime,
      difficulty: destination.difficulty,
      tags: this.parseJsonArray(destination.tags),
      coverImageUrl: destination.coverImageUrl,
      coverImagePublicId: destination.coverImagePublicId,
      images: imagesList,
      facilities: this.parseJsonArray(destination.facilities),
      tips: this.parseJsonArray(destination.tips),
      status: destination.status,
      isFeatured: destination.isFeatured,
      reviewsCount: destination._count?.reviews ?? destination.reviewCount,
      favoritesCount: destination._count?.favorites ?? 0,
      deletedAt: destination.deletedAt,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt,
    };
  };

  public async getDestinations(query: AdminDestinationFilterQuery): Promise<{
    data: Array<ReturnType<AdminDestinationsService['mapToAdminDto']>>;
    meta: PaginationMeta;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item) => this.mapToAdminDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public async getDestinationByIdOrSlug(idOrSlug: string, includeDeleted = true) {
    const destination = await this.repository.findByIdOrSlug(idOrSlug, includeDeleted);
    if (!destination) {
      throw new NotFoundError(`Destination '${idOrSlug}' not found`, 'DESTINATION_NOT_FOUND');
    }
    return this.mapToAdminDto(destination);
  }

  public async createDestination(
    dto: CreateDestinationDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Verify Category exists
    const category = await prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundError(
        `Category with ID '${dto.categoryId}' not found`,
        'CATEGORY_NOT_FOUND',
      );
    }

    // 2. Generate and verify unique slug
    let slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    const existingWithSlug = await this.repository.findBySlug(slug);
    if (existingWithSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    // 3. Resolve cover image & public ID
    let coverImageUrl = dto.coverImageUrl || '';
    let coverImagePublicId: string | null = null;

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrl = dto.coverImage.secureUrl;
      coverImagePublicId = dto.coverImage.publicId;
      if (adminUserId && coverImagePublicId) {
        this.cloudinary.validateAdminAssetOwnership(coverImagePublicId, adminUserId, 'DESTINATION');
      }
    }

    // 4. Resolve multiple gallery images
    const newPublicIds: string[] = [];
    if (coverImagePublicId) {
      newPublicIds.push(coverImagePublicId);
    }

    const imagesToCreate: Array<{
      imageUrl: string;
      imagePublicId?: string | null;
      caption?: string | null;
      altText?: string | null;
      orderIndex: number;
      isPrimary: boolean;
    }> = [];

    if (Array.isArray(dto.images) && dto.images.length > 0) {
      dto.images.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const asset = item as CloudinaryAssetInput;
          if (asset.publicId) {
            if (adminUserId) {
              this.cloudinary.validateAdminAssetOwnership(
                asset.publicId,
                adminUserId,
                'DESTINATION',
              );
            }
            newPublicIds.push(asset.publicId);
          }
          imagesToCreate.push({
            imageUrl: asset.secureUrl,
            imagePublicId: asset.publicId || null,
            caption: asset.caption || null,
            altText: asset.altText || null,
            orderIndex: asset.orderIndex !== undefined ? asset.orderIndex : index,
            isPrimary: asset.isPrimary ?? false,
          });
        } else if (typeof item === 'string' && item.trim().length > 0) {
          imagesToCreate.push({
            imageUrl: item.trim(),
            orderIndex: index,
            isPrimary: false,
          });
        }
      });
    }

    // 5. Prepare data fields
    const entranceFee = dto.ticketPrice !== undefined ? dto.ticketPrice : (dto.entranceFee ?? 0);
    const estimatedDuration =
      dto.estimatedDuration !== undefined
        ? dto.estimatedDuration
        : (dto.estimatedDurationMinutes ?? 60);
    const shortDesc = dto.shortDescription || dto.description.slice(0, 160);

    try {
      const created = await this.repository.create({
        name: dto.name,
        slug,
        shortDescription: shortDesc,
        description: dto.description,
        category: { connect: { id: dto.categoryId } },
        region: dto.region,
        locationName: dto.locationName,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        entranceFee,
        currency: dto.currency || 'IDR',
        openingHours: dto.openingHours || '08:00 - 17:00',
        estimatedDurationMinutes: estimatedDuration,
        bestVisitingTime: dto.bestVisitingTime || 'Pagi / Sore hari',
        difficulty: dto.difficulty || 'EASY',
        tags: JSON.stringify(dto.tags || []),
        coverImageUrl,
        coverImagePublicId,
        facilities: JSON.stringify(dto.facilities || []),
        tips: JSON.stringify(dto.tips || []),
        status: dto.status || 'PUBLISHED',
        isFeatured: dto.isFeatured ?? false,
        ...(imagesToCreate.length > 0 && {
          images: {
            create: imagesToCreate,
          },
        }),
      });

      // Invalidate public destinations cache
      destinationsService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_DESTINATION',
        entity: 'Destination',
        entityId: created.id,
        details: JSON.stringify({ name: created.name, slug: created.slug }),
        ipAddress,
        userAgent,
      });

      return this.mapToAdminDto(created);
    } catch (error) {
      // Rollback newly uploaded assets on database creation failure
      if (newPublicIds.length > 0) {
        logger.warn(
          { newPublicIds, error },
          'Rolling back Cloudinary assets due to Destination create failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateDestination(
    id: string,
    dto: UpdateDestinationDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Verify destination exists
    const destination = await this.repository.findByIdOrSlug(id, true);
    if (!destination) {
      throw new NotFoundError(`Destination '${id}' not found`, 'DESTINATION_NOT_FOUND');
    }

    // 2. If category is updated, verify it exists
    if (dto.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundError(
          `Category with ID '${dto.categoryId}' not found`,
          'CATEGORY_NOT_FOUND',
        );
      }
    }

    // 3. If slug is updated, check uniqueness
    let slugToUpdate = destination.slug;
    if (dto.slug && dto.slug !== destination.slug) {
      const formattedSlug = this.slugify(dto.slug);
      const existingWithSlug = await this.repository.findBySlug(formattedSlug);
      if (existingWithSlug && existingWithSlug.id !== destination.id) {
        throw new ConflictError(
          `Slug '${formattedSlug}' is already in use by another destination`,
          'SLUG_ALREADY_EXISTS',
        );
      }
      slugToUpdate = formattedSlug;
    }

    // 4. Resolve cover image & public ID
    let coverImageUrlToUpdate: string | undefined = undefined;
    let coverImagePublicIdToUpdate: string | null | undefined = undefined;
    const newPublicIds: string[] = [];
    let isCoverUnchanged = false;

    if (dto.coverImage && typeof dto.coverImage === 'object') {
      coverImageUrlToUpdate = dto.coverImage.secureUrl;
      coverImagePublicIdToUpdate = dto.coverImage.publicId;
      isCoverUnchanged = Boolean(
        (destination.coverImagePublicId &&
          destination.coverImagePublicId === coverImagePublicIdToUpdate) ||
        (destination.coverImageUrl && destination.coverImageUrl === coverImageUrlToUpdate),
      );

      if (adminUserId && coverImagePublicIdToUpdate && !isCoverUnchanged) {
        this.cloudinary.validateAdminAssetOwnership(
          coverImagePublicIdToUpdate,
          adminUserId,
          'DESTINATION',
        );
        newPublicIds.push(coverImagePublicIdToUpdate);
      }
    } else if (dto.coverImageUrl !== undefined) {
      coverImageUrlToUpdate = dto.coverImageUrl;
    }

    // 5. Handle gallery images if provided
    let imagesCreateData:
      | Array<{
          imageUrl: string;
          imagePublicId?: string | null;
          caption?: string | null;
          altText?: string | null;
          orderIndex: number;
          isPrimary: boolean;
        }>
      | undefined = undefined;

    const existingImagePublicIds = new Set(
      (destination.images || []).map((img) => img.imagePublicId).filter(Boolean),
    );
    const existingImageUrls = new Set(
      (destination.images || []).map((img) => img.imageUrl).filter(Boolean),
    );

    if (Array.isArray(dto.images)) {
      imagesCreateData = [];
      dto.images.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const asset = item as CloudinaryAssetInput;
          const isExistingGalleryImage = Boolean(
            (asset.publicId && existingImagePublicIds.has(asset.publicId)) ||
            (asset.secureUrl && existingImageUrls.has(asset.secureUrl)),
          );

          if (asset.publicId && adminUserId && !isExistingGalleryImage) {
            this.cloudinary.validateAdminAssetOwnership(asset.publicId, adminUserId, 'DESTINATION');
            newPublicIds.push(asset.publicId);
          }
          imagesCreateData!.push({
            imageUrl: asset.secureUrl,
            imagePublicId: asset.publicId || null,
            caption: asset.caption || null,
            altText: asset.altText || null,
            orderIndex: asset.orderIndex !== undefined ? asset.orderIndex : index,
            isPrimary: asset.isPrimary ?? false,
          });
        } else if (typeof item === 'string' && item.trim().length > 0) {
          imagesCreateData!.push({
            imageUrl: item.trim(),
            orderIndex: index,
            isPrimary: false,
          });
        }
      });
    }

    const entranceFee =
      dto.ticketPrice !== undefined
        ? dto.ticketPrice
        : dto.entranceFee !== undefined
          ? dto.entranceFee
          : undefined;

    const estimatedDuration =
      dto.estimatedDuration !== undefined
        ? dto.estimatedDuration
        : dto.estimatedDurationMinutes !== undefined
          ? dto.estimatedDurationMinutes
          : undefined;

    try {
      const updated = await this.repository.update(destination.id, {
        ...(dto.name && { name: dto.name }),
        ...(slugToUpdate && { slug: slugToUpdate }),
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription }),
        ...(dto.description && { description: dto.description }),
        ...(dto.categoryId && { category: { connect: { id: dto.categoryId } } }),
        ...(dto.region && { region: dto.region }),
        ...(dto.locationName && { locationName: dto.locationName }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(entranceFee !== undefined && { entranceFee }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.openingHours && { openingHours: dto.openingHours }),
        ...(estimatedDuration !== undefined && { estimatedDurationMinutes: estimatedDuration }),
        ...(dto.bestVisitingTime && { bestVisitingTime: dto.bestVisitingTime }),
        ...(dto.difficulty && { difficulty: dto.difficulty }),
        ...(dto.tags && { tags: JSON.stringify(dto.tags) }),
        ...(coverImageUrlToUpdate !== undefined && { coverImageUrl: coverImageUrlToUpdate }),
        ...(coverImagePublicIdToUpdate !== undefined && {
          coverImagePublicId: coverImagePublicIdToUpdate,
        }),
        ...(dto.facilities && { facilities: JSON.stringify(dto.facilities) }),
        ...(dto.tips && { tips: JSON.stringify(dto.tips) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(imagesCreateData !== undefined && {
          images: {
            deleteMany: {},
            create: imagesCreateData,
          },
        }),
      });

      // Clean up old cover asset if replaced post-commit
      if (
        coverImagePublicIdToUpdate &&
        !isCoverUnchanged &&
        destination.coverImagePublicId &&
        destination.coverImagePublicId !== coverImagePublicIdToUpdate
      ) {
        this.cloudinary.deleteAsset(destination.coverImagePublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: destination.coverImagePublicId },
            'Failed to delete replaced cover asset',
          );
        });
      }

      // Invalidate public destinations cache
      destinationsService.clearCache();

      // Audit Log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_DESTINATION',
        entity: 'Destination',
        entityId: updated.id,
        details: JSON.stringify({ name: updated.name, changes: Object.keys(dto) }),
        ipAddress,
        userAgent,
      });

      return this.mapToAdminDto(updated);
    } catch (error) {
      if (newPublicIds.length > 0) {
        logger.warn(
          { newPublicIds, error },
          'Rolling back Cloudinary assets due to Destination update failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateDestinationStatus(
    idOrSlug: string,
    status: DestinationStatus,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const destination = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!destination) {
      throw new NotFoundError(`Destination '${idOrSlug}' not found`, 'DESTINATION_NOT_FOUND');
    }

    const updated = await this.repository.update(destination.id, {
      status,
      deletedAt: status === 'ARCHIVED' ? new Date() : null,
    });

    // Invalidate public destinations cache
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'UPDATE_DESTINATION_STATUS',
      entity: 'Destination',
      entityId: updated.id,
      details: JSON.stringify({ previousStatus: destination.status, newStatus: status }),
      ipAddress,
      userAgent,
    });

    return this.mapToAdminDto(updated);
  }

  public async deleteDestination(
    id: string,
    hardDelete = false,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const destination = await this.repository.findByIdOrSlug(id, true);
    if (!destination) {
      throw new NotFoundError(`Destination '${id}' not found`, 'DESTINATION_NOT_FOUND');
    }

    const assetsToDelete: string[] = [];
    if (hardDelete) {
      if (destination.coverImagePublicId) {
        assetsToDelete.push(destination.coverImagePublicId);
      }
      if (Array.isArray(destination.images)) {
        destination.images.forEach((img) => {
          if (img.imagePublicId) {
            assetsToDelete.push(img.imagePublicId);
          }
        });
      }
      await this.repository.hardDelete(destination.id);
      if (assetsToDelete.length > 0) {
        this.cloudinary.deleteMultipleAssets(assetsToDelete).catch(() => {});
      }
    } else {
      await this.repository.softDelete(destination.id);
    }

    // Invalidate public destinations cache
    destinationsService.clearCache();

    // Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: hardDelete ? 'HARD_DELETE_DESTINATION' : 'SOFT_DELETE_DESTINATION',
      entity: 'Destination',
      entityId: destination.id,
      details: JSON.stringify({ name: destination.name, slug: destination.slug, hardDelete }),
      ipAddress,
      userAgent,
    });
  }

  public async bulkDeleteDestinations(
    dto: BulkDeleteDestinationsDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ affectedCount: number; hard: boolean }> {
    // 1. Validate all IDs exist
    const existingIds = await this.repository.findExistingIds(dto.ids);
    const missingIds = dto.ids.filter((id) => !existingIds.includes(id));
    if (missingIds.length > 0) {
      throw new NotFoundError(
        `Destinations not found for ID(s): ${missingIds.join(', ')}`,
        'DESTINATIONS_NOT_FOUND',
      );
    }

    // 2. If hard delete, gather publicIds before deletion
    const assetsToDelete: string[] = [];
    if (dto.hard) {
      const destsWithImages = await prisma.destination.findMany({
        where: { id: { in: dto.ids } },
        include: { images: true },
      });
      destsWithImages.forEach((d) => {
        if (d.coverImagePublicId) assetsToDelete.push(d.coverImagePublicId);
        d.images.forEach((img) => {
          if (img.imagePublicId) assetsToDelete.push(img.imagePublicId);
        });
      });
    }

    // 3. Perform bulk deletion via Prisma transaction
    const result = dto.hard
      ? await this.repository.bulkHardDelete(dto.ids)
      : await this.repository.bulkSoftDelete(dto.ids);

    if (dto.hard && assetsToDelete.length > 0) {
      this.cloudinary.deleteMultipleAssets(assetsToDelete).catch(() => {});
    }

    // 4. Invalidate public destinations cache
    destinationsService.clearCache();

    // 5. Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: dto.hard ? 'BULK_HARD_DELETE_DESTINATIONS' : 'BULK_SOFT_DELETE_DESTINATIONS',
      entity: 'Destination',
      details: JSON.stringify({
        ids: dto.ids,
        affectedCount: result.count,
        hard: dto.hard,
      }),
      ipAddress,
      userAgent,
    });

    return {
      affectedCount: result.count,
      hard: dto.hard ?? false,
    };
  }

  public async bulkUpdateDestinationStatus(
    dto: BulkUpdateDestinationStatusDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ affectedCount: number; status: DestinationStatus }> {
    // 1. Validate all IDs exist
    const existingIds = await this.repository.findExistingIds(dto.ids);
    const missingIds = dto.ids.filter((id) => !existingIds.includes(id));
    if (missingIds.length > 0) {
      throw new NotFoundError(
        `Destinations not found for ID(s): ${missingIds.join(', ')}`,
        'DESTINATIONS_NOT_FOUND',
      );
    }

    // 2. Perform bulk status update via Prisma transaction
    const result = await this.repository.bulkUpdateStatus(dto.ids, dto.status);

    // 3. Invalidate public destinations cache
    destinationsService.clearCache();

    // 4. Audit Log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'BULK_UPDATE_DESTINATION_STATUS',
      entity: 'Destination',
      details: JSON.stringify({
        ids: dto.ids,
        status: dto.status,
        affectedCount: result.count,
      }),
      ipAddress,
      userAgent,
    });

    return {
      affectedCount: result.count,
      status: dto.status,
    };
  }
}

export const adminDestinationsService = new AdminDestinationsService();
