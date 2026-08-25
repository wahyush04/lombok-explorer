import { Accommodation } from '@prisma/client';
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
import { ConflictError, NotFoundError } from '../../../common/errors/app-error';

export class AdminAccommodationsService {
  constructor(
    private readonly repository: AdminAccommodationsRepository = adminAccommodationsRepository,
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

    const amenitiesList = dto.facilities || dto.amenities || [];

    // 2. Create accommodation
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
      coverImageUrl: dto.coverImageUrl,
      images: JSON.stringify(dto.images || []),
      amenities: JSON.stringify(amenitiesList),
      contactPhone: dto.contactPhone || null,
      websiteUrl: dto.websiteUrl || null,
      status: dto.status,
      isFeatured: dto.isFeatured,
    });

    // 3. Audit log
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

    const amenitiesList = dto.facilities || dto.amenities;

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
      ...(dto.coverImageUrl && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.images && { images: JSON.stringify(dto.images) }),
      ...(amenitiesList && { amenities: JSON.stringify(amenitiesList) }),
      ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
      ...(dto.status && { status: dto.status }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
    });

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
