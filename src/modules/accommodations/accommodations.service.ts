import { Accommodation } from '@prisma/client';
import { accommodationsRepository, AccommodationsRepository } from './accommodations.repository';
import { AccommodationDto, AccommodationFilterQuery } from './dto/accommodation.dto';
import { NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';

export class AccommodationsService {
  constructor(private readonly repository: AccommodationsRepository = accommodationsRepository) {}

  public mapToDto = (accommodation: Accommodation): AccommodationDto => {
    let parsedImages: string[] = [];
    if (accommodation.images) {
      try {
        parsedImages = JSON.parse(accommodation.images);
      } catch {
        parsedImages = [accommodation.images];
      }
    }

    let parsedAmenities: string[] = [];
    if (accommodation.amenities) {
      try {
        parsedAmenities = JSON.parse(accommodation.amenities);
      } catch {
        parsedAmenities = [accommodation.amenities];
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
      amenities: parsedAmenities,
      contactPhone: accommodation.contactPhone,
      websiteUrl: accommodation.websiteUrl,
      status: accommodation.status,
      isFeatured: accommodation.isFeatured,
      createdAt: accommodation.createdAt,
      updatedAt: accommodation.updatedAt,
    };
  };

  public async getAccommodations(query: AccommodationFilterQuery): Promise<{
    data: AccommodationDto[];
    meta: PaginationMeta;
  }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(this.mapToDto),
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

  public async getFeaturedAccommodations(limit = 6): Promise<AccommodationDto[]> {
    const items = await this.repository.findFeatured(limit);
    return items.map(this.mapToDto);
  }

  public async getAccommodationByIdOrSlug(idOrSlug: string): Promise<AccommodationDto> {
    const item = await this.repository.findByIdOrSlug(idOrSlug);
    if (!item) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }
    return this.mapToDto(item);
  }
}

export const accommodationsService = new AccommodationsService();
