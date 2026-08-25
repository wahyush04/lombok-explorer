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
import { ConflictError, NotFoundError } from '../../../common/errors/app-error';

export class AdminRestaurantsService {
  constructor(
    private readonly repository: AdminRestaurantsRepository = adminRestaurantsRepository,
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

    // 2. Create restaurant
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
      coverImageUrl: dto.coverImageUrl,
      images: JSON.stringify(dto.images || []),
      isHalalCertified: dto.isHalalCertified,
      status: dto.status,
      isFeatured: dto.isFeatured,
    });

    // 3. Audit log
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
      ...(dto.coverImageUrl && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.images && { images: JSON.stringify(dto.images) }),
      ...(dto.isHalalCertified !== undefined && { isHalalCertified: dto.isHalalCertified }),
      ...(dto.status && { status: dto.status }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
    });

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
