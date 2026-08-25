import {
  adminDestinationsRepository,
  AdminDestinationsRepository,
  AdminDestinationWithRelations,
} from './admin-destinations.repository';
import { DestinationStatus } from '@prisma/client';
import {
  AdminDestinationFilterQuery,
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/admin-destination.dto';
import { ConflictError, NotFoundError } from '../../../common/errors/app-error';
import { destinationsService } from '../../destinations/destinations.service';
import { prisma } from '../../../database/prisma';
import { PaginationMeta } from '../../../common/types';

export class AdminDestinationsService {
  constructor(
    private readonly repository: AdminDestinationsRepository = adminDestinationsRepository,
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

    // 3. Prepare data fields
    const entranceFee = dto.ticketPrice !== undefined ? dto.ticketPrice : (dto.entranceFee ?? 0);
    const estimatedDuration =
      dto.estimatedDuration !== undefined
        ? dto.estimatedDuration
        : (dto.estimatedDurationMinutes ?? 60);
    const shortDesc = dto.shortDescription || dto.description.slice(0, 160);

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
      coverImageUrl: dto.coverImageUrl || '',
      facilities: JSON.stringify(dto.facilities || []),
      tips: JSON.stringify(dto.tips || []),
      status: dto.status || 'PUBLISHED',
      isFeatured: dto.isFeatured ?? false,
      ...(Array.isArray(dto.images) &&
        dto.images.length > 0 && {
          images: {
            create: dto.images.map((imgUrl, index) => ({
              imageUrl: imgUrl,
              orderIndex: index,
            })),
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
      ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.facilities && { facilities: JSON.stringify(dto.facilities) }),
      ...(dto.tips && { tips: JSON.stringify(dto.tips) }),
      ...(dto.status && { status: dto.status }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
    });

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

    if (hardDelete) {
      await this.repository.hardDelete(destination.id);
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
}

export const adminDestinationsService = new AdminDestinationsService();
