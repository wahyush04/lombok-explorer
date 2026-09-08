import { restaurantsRepository, RestaurantsRepository, RestaurantWithTranslations } from './restaurants.repository';
import { RestaurantDto, RestaurantFilterQuery } from './dto/restaurant.dto';
import { NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';
import { resolveLocalizedFields } from '../../i18n/content-fallback.util';
import { DEFAULT_LOCALE } from '../../i18n/types';

export class RestaurantsService {
  constructor(private readonly repository: RestaurantsRepository = restaurantsRepository) {}

  public mapToDto = (restaurant: RestaurantWithTranslations, locale: string = DEFAULT_LOCALE): RestaurantDto => {
    const imagesList: string[] = [];
    if (restaurant.coverImageUrl) {
      imagesList.push(restaurant.coverImageUrl);
    }
    if (Array.isArray(restaurant.images)) {
      restaurant.images.forEach((img: any) => {
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
    } else if (typeof (restaurant as any).images === 'string') {
      try {
        const parsed = JSON.parse((restaurant as any).images);
        if (Array.isArray(parsed)) {
          parsed.forEach((url: string) => {
            if (url && !imagesList.includes(url)) imagesList.push(url);
          });
        }
      } catch {
        if (!imagesList.includes((restaurant as any).images)) {
          imagesList.push((restaurant as any).images);
        }
      }
    }

    const localized = resolveLocalizedFields(
      locale,
      restaurant.translations,
      restaurant,
      ['name', 'description'],
    );

    return {
      id: restaurant.id,
      name: localized.name,
      slug: restaurant.slug,
      description: localized.description,
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
      images: imagesList,
      isHalalCertified: restaurant.isHalalCertified,
      status: restaurant.status,
      isFeatured: restaurant.isFeatured,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    };
  };

  public async getRestaurants(
    query: RestaurantFilterQuery,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{
    data: RestaurantDto[];
    meta: PaginationMeta;
  }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map((item) => this.mapToDto(item, locale)),
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

  public async getFeaturedRestaurants(limit = 6, locale: string = DEFAULT_LOCALE): Promise<RestaurantDto[]> {
    const items = await this.repository.findFeatured(limit);
    return items.map((item) => this.mapToDto(item, locale));
  }

  public async getRestaurantByIdOrSlug(idOrSlug: string, locale: string = DEFAULT_LOCALE): Promise<RestaurantDto> {
    const item = await this.repository.findByIdOrSlug(idOrSlug);
    if (!item) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
    }
    return this.mapToDto(item, locale);
  }
}

export const restaurantsService = new RestaurantsService();
