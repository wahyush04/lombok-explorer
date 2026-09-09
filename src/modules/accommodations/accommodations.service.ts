import { AccommodationFilterQuery, AccommodationDto } from './dto/accommodation.dto';
import { accommodationsRepository, AccommodationsRepository, AccommodationWithTranslations } from './accommodations.repository';
import { NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';
import { resolveLocalizedFields } from '../../i18n/content-fallback.util';
import { DEFAULT_LOCALE } from '../../i18n/types';

export class AccommodationsService {
  constructor(private readonly repository: AccommodationsRepository = accommodationsRepository) {}

  public mapToDto = (
    accommodation: AccommodationWithTranslations,
    isFavorite?: boolean,
    locale: string = DEFAULT_LOCALE,
  ): AccommodationDto => {
    const imagesList: string[] = [];
    if (accommodation.coverImageUrl) {
      imagesList.push(accommodation.coverImageUrl);
    }
    if (Array.isArray(accommodation.images)) {
      accommodation.images.forEach((img: any) => {
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
    } else if (typeof (accommodation as any).images === 'string') {
      try {
        const parsed = JSON.parse((accommodation as any).images);
        if (Array.isArray(parsed)) {
          parsed.forEach((url: string) => {
            if (url && !imagesList.includes(url)) imagesList.push(url);
          });
        }
      } catch {
        if (!imagesList.includes((accommodation as any).images)) {
          imagesList.push((accommodation as any).images);
        }
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

    const localized = resolveLocalizedFields(
      locale,
      accommodation.translations,
      accommodation,
      ['name', 'description'],
    );

    const computedIsFavorite =
      isFavorite !== undefined
        ? isFavorite
        : accommodation.favorites !== undefined
          ? accommodation.favorites.length > 0
          : false;

    return {
      id: accommodation.id,
      name: localized.name,
      slug: accommodation.slug,
      type: accommodation.type,
      description: localized.description,
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
      images: imagesList,
      amenities: parsedAmenities,
      contactPhone: accommodation.contactPhone,
      websiteUrl: accommodation.websiteUrl,
      status: accommodation.status,
      isFeatured: accommodation.isFeatured,
      isFavorite: computedIsFavorite,
      createdAt: accommodation.createdAt,
      updatedAt: accommodation.updatedAt,
    };
  };

  public async getAccommodations(
    query: AccommodationFilterQuery,
    locale: string = DEFAULT_LOCALE,
    userId?: string,
  ): Promise<{
    data: AccommodationDto[];
    meta: PaginationMeta;
  }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.findMany(query, userId);
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map((item) => this.mapToDto(item, undefined, locale)),
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

  public async getFeaturedAccommodations(
    limit = 6,
    locale: string = DEFAULT_LOCALE,
    userId?: string,
  ): Promise<AccommodationDto[]> {
    const items = await this.repository.findFeatured(limit, userId);
    return items.map((item) => this.mapToDto(item, undefined, locale));
  }

  public async getAccommodationByIdOrSlug(
    idOrSlug: string,
    locale: string = DEFAULT_LOCALE,
    userId?: string,
  ): Promise<AccommodationDto> {
    const item = await this.repository.findByIdOrSlug(idOrSlug, userId);
    if (!item) {
      throw new NotFoundError(`Accommodation '${idOrSlug}' not found`, 'ACCOMMODATION_NOT_FOUND');
    }
    return this.mapToDto(item, undefined, locale);
  }
}

export const accommodationsService = new AccommodationsService();
