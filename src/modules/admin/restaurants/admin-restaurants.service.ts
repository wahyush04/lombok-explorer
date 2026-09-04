import { DestinationStatus, Restaurant } from '@prisma/client';
import {
  adminRestaurantsRepository,
  AdminRestaurantsRepository,
} from './admin-restaurants.repository';
import {
  AdminRestaurantDto,
  AdminRestaurantFilterQuery,
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from './dto/admin-restaurant.dto';
import { BadRequestError, ConflictError, NotFoundError } from '../../../common/errors/app-error';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';
import { CloudinaryAssetInput } from '../uploads/dto/admin-uploads.dto';

export class AdminRestaurantsService {
  constructor(
    private readonly repository: AdminRestaurantsRepository = adminRestaurantsRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public mapToDto = (restaurant: Restaurant): AdminRestaurantDto => {
    let parsedImages: string[] = [];
    if (restaurant.images) {
      try {
        parsedImages = JSON.parse(restaurant.images);
      } catch {
        parsedImages = [];
      }
    }

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      cuisineType: restaurant.cuisineType,
      specialtyDish: restaurant.specialtyDish,
      priceRange: restaurant.priceRange,
      minPrice: Number(restaurant.minPrice),
      maxPrice: Number(restaurant.maxPrice),
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      address: restaurant.address,
      region: restaurant.region,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      openingHours: restaurant.openingHours,
      coverImageUrl: restaurant.coverImageUrl,
      coverImagePublicId: restaurant.coverImagePublicId,
      images: parsedImages,
      isHalalCertified: restaurant.isHalalCertified,
      status: restaurant.status,
      isFeatured: restaurant.isFeatured,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      deletedAt: restaurant.deletedAt,
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

  public async getRestaurants(query: AdminRestaurantFilterQuery) {
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

  public async getRestaurantById(idOrSlug: string): Promise<AdminRestaurantDto> {
    const restaurant = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!restaurant) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
    }
    return this.mapToDto(restaurant);
  }

  public async createRestaurant(
    dto: CreateRestaurantDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminRestaurantDto> {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    // 1. Check slug uniqueness
    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw new ConflictError(
        `Restaurant with slug '${slug}' already exists`,
        'RESTAURANT_SLUG_EXISTS',
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
        this.cloudinary.validateAdminAssetOwnership(coverImagePublicId, adminUserId, 'RESTAURANT');
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
                'RESTAURANT',
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

    try {
      // 4. Create restaurant
      const created = await this.repository.create({
        name: dto.name,
        slug,
        description: dto.description,
        cuisineType: dto.cuisineType,
        specialtyDish: dto.specialtyDish,
        priceRange: dto.priceRange,
        minPrice: dto.minPrice,
        maxPrice: dto.maxPrice,
        address: dto.address,
        region: dto.region,
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingHours: dto.openingHours,
        coverImageUrl,
        coverImagePublicId,
        images: JSON.stringify(imagesList),
        isHalalCertified: dto.isHalalCertified,
        status: dto.status,
        isFeatured: dto.isFeatured,
      });

      // 5. Audit log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'CREATE_RESTAURANT',
        entity: 'Restaurant',
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
          'Rolling back Cloudinary assets due to Restaurant create failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateRestaurant(
    idOrSlug: string,
    dto: UpdateRestaurantDto,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminRestaurantDto> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
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
          `Restaurant with slug '${slug}' already exists`,
          'RESTAURANT_SLUG_EXISTS',
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
          'RESTAURANT',
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
                'RESTAURANT',
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

    try {
      const updated = await this.repository.update(existing.id, {
        ...(dto.name && { name: dto.name }),
        ...(slug && { slug }),
        ...(dto.description && { description: dto.description }),
        ...(dto.cuisineType && { cuisineType: dto.cuisineType }),
        ...(dto.specialtyDish && { specialtyDish: dto.specialtyDish }),
        ...(dto.priceRange && { priceRange: dto.priceRange }),
        ...(dto.minPrice !== undefined && { minPrice: dto.minPrice }),
        ...(dto.maxPrice !== undefined && { maxPrice: dto.maxPrice }),
        ...(dto.address && { address: dto.address }),
        ...(dto.region && { region: dto.region }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.openingHours && { openingHours: dto.openingHours }),
        ...(coverImageUrlToUpdate !== undefined && { coverImageUrl: coverImageUrlToUpdate }),
        ...(coverImagePublicIdToUpdate !== undefined && {
          coverImagePublicId: coverImagePublicIdToUpdate,
        }),
        ...(imagesJsonToUpdate !== undefined && { images: imagesJsonToUpdate }),
        ...(dto.isHalalCertified !== undefined && { isHalalCertified: dto.isHalalCertified }),
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
            'Failed to delete replaced restaurant cover asset',
          );
        });
      }

      // Audit log
      await this.repository.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_RESTAURANT',
        entity: 'Restaurant',
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
          'Rolling back Cloudinary assets due to Restaurant update failure',
        );
        await this.cloudinary.deleteMultipleAssets(newPublicIds).catch(() => {});
      }
      throw error;
    }
  }

  public async updateRestaurantStatus(
    idOrSlug: string,
    status: DestinationStatus,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminRestaurantDto> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
    }

    const updated = await this.repository.update(existing.id, {
      status,
      deletedAt: status === 'ARCHIVED' ? new Date() : null,
    });

    // Audit log
    await this.repository.createAuditLog({
      userId: adminUserId,
      action: 'UPDATE_RESTAURANT_STATUS',
      entity: 'Restaurant',
      entityId: updated.id,
      details: JSON.stringify({ previousStatus: existing.status, newStatus: status }),
      ipAddress,
      userAgent,
    });

    return this.mapToDto(updated);
  }

  public async deleteRestaurant(
    idOrSlug: string,
    hard = false,
    adminUserId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.repository.findByIdOrSlug(idOrSlug, true);
    if (!existing) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
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
      action: hard ? 'HARD_DELETE_RESTAURANT' : 'SOFT_DELETE_RESTAURANT',
      entity: 'Restaurant',
      entityId: existing.id,
      details: JSON.stringify({ name: existing.name, hard }),
      ipAddress,
      userAgent,
    });
  }
}

export const adminRestaurantsService = new AdminRestaurantsService();
