import { Category, Destination, DestinationImage } from '@prisma/client';
import { NotFoundError } from '../../common/errors/app-error';
import {
  DestinationDto,
  DestinationFilterQuery,
  NearbyDestinationDto,
  NearbyDestinationQuery,
  SearchDestinationQuery,
} from './dto/destination.dto';
import { destinationsRepository, DestinationsRepository } from './destinations.repository';
import { PaginationMeta } from '../../common/types';

export type DestinationWithRelations = Destination & {
  category?: Category | null;
  images?: (DestinationImage | string)[] | null;
  favorites?: { id: string }[];
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class DestinationsService {
  private featuredCache = new Map<number, CacheEntry<DestinationDto[]>>();
  private readonly FEATURED_TTL_MS = 2 * 60 * 1000; // 2 minutes cache for featured destinations

  constructor(private readonly repository: DestinationsRepository = destinationsRepository) {}

  public clearCache(): void {
    this.featuredCache.clear();
  }

  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  }

  private parseJsonArray(jsonString: string | null | undefined): string[] {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return jsonString ? [jsonString] : [];
    }
  }

  public mapToDto(destination: DestinationWithRelations, isFavorite?: boolean): DestinationDto {
    const imagesList: string[] = [];
    if (destination.coverImageUrl) {
      imagesList.push(destination.coverImageUrl);
    }
    if (Array.isArray(destination.images)) {
      destination.images.forEach((img: DestinationImage | string) => {
        if (typeof img === 'string') {
          if (!imagesList.includes(img)) imagesList.push(img);
        } else if (
          img &&
          typeof img === 'object' &&
          'imageUrl' in img &&
          !imagesList.includes(img.imageUrl)
        ) {
          imagesList.push(img.imageUrl);
        }
      });
    }

    const computedIsFavorite =
      isFavorite !== undefined
        ? isFavorite
        : destination.favorites !== undefined
          ? destination.favorites.length > 0
          : false;

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
      currency: destination.currency || 'IDR',
      openingHours: destination.openingHours,
      estimatedDurationMinutes: destination.estimatedDurationMinutes,
      bestVisitingTime: destination.bestVisitingTime,
      difficulty: destination.difficulty,
      tags: this.parseJsonArray(destination.tags),
      coverImageUrl: destination.coverImageUrl,
      images: imagesList,
      facilities: this.parseJsonArray(destination.facilities),
      tips: this.parseJsonArray(destination.tips),
      isFeatured: destination.isFeatured,
      isFavorite: computedIsFavorite,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt,
    };
  }

  public async getDestinations(
    query: DestinationFilterQuery,
    userId?: string,
  ): Promise<{
    data: DestinationDto[];
    meta: PaginationMeta;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const sortBy = query.sort_by || query.sortBy || 'popular';
    const order = query.order || 'desc';
    const minRating = query.min_rating ?? query.minRating;
    const minPrice = query.min_price ?? query.minPrice;
    const maxPrice = query.max_price ?? query.maxPrice;

    const { items, total } = await this.repository.findMany(
      {
        page,
        limit,
        search: query.search,
        category: query.category,
        region: query.region,
        difficulty: query.difficulty,
        minRating,
        minPrice,
        maxPrice,
        isFeatured: query.is_featured,
        tag: query.tag,
        sortBy,
        order,
      },
      userId,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item: DestinationWithRelations) => this.mapToDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        currentPage: page,
        totalCount: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  public async getDestinationByIdOrSlug(
    idOrSlug: string,
    userId?: string,
  ): Promise<DestinationDto> {
    const destination = await this.repository.findByIdOrSlug(idOrSlug, userId);
    if (!destination) {
      throw new NotFoundError(`Destination '${idOrSlug}' not found`, 'DESTINATION_NOT_FOUND');
    }

    const isFavorite = destination.favorites && destination.favorites.length > 0;
    return this.mapToDto(destination as DestinationWithRelations, isFavorite);
  }

  public async getFeaturedDestinations(limit = 6, userId?: string): Promise<DestinationDto[]> {
    if (!userId) {
      const now = Date.now();
      const cached = this.featuredCache.get(limit);
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }

      const items = await this.repository.findFeatured(limit);
      const mapped = items.map((item: DestinationWithRelations) => this.mapToDto(item));

      this.featuredCache.set(limit, {
        data: mapped,
        expiresAt: now + this.FEATURED_TTL_MS,
      });

      return mapped;
    }

    const items = await this.repository.findFeatured(limit, userId);
    return items.map((item: DestinationWithRelations) => this.mapToDto(item));
  }

  public async getNearbyDestinations(
    query: NearbyDestinationQuery,
    userId?: string,
  ): Promise<NearbyDestinationDto[]> {
    const targetLat = query.lat ?? query.latitude!;
    const targetLng = query.lng ?? query.longitude!;
    const radiusKm = query.radius_km ?? query.radius ?? 25;
    const limit = query.limit || 10;

    const allDestinations = await this.repository.findAllForGeospatial(
      query.category,
      200,
      userId,
    );

    const destinationsWithDistance: NearbyDestinationDto[] = allDestinations
      .map((dest: DestinationWithRelations) => {
        const distanceKm = this.calculateDistanceKm(
          targetLat,
          targetLng,
          dest.latitude,
          dest.longitude,
        );
        const dto = this.mapToDto(dest);
        return {
          ...dto,
          distanceKm,
        };
      })
      .filter((dest) => dest.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return destinationsWithDistance;
  }

  public async searchDestinations(
    query: SearchDestinationQuery,
    userId?: string,
  ): Promise<{
    data: DestinationDto[];
    meta: PaginationMeta;
  }> {
    const searchTerm = query.q || query.query || query.keyword || '';
    const page = query.page || 1;
    const limit = query.limit || 10;

    const { items, total } = await this.repository.findMany(
      {
        page,
        limit,
        search: searchTerm,
      },
      userId,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item: DestinationWithRelations) => this.mapToDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        currentPage: page,
        totalCount: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}

export const destinationsService = new DestinationsService();
