import { Restaurant } from '@prisma/client';
import { restaurantsRepository, RestaurantsRepository } from './restaurants.repository';
import { RestaurantDto, RestaurantFilterQuery } from './dto/restaurant.dto';
import { NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';

export class RestaurantsService {
  constructor(private readonly repository: RestaurantsRepository = restaurantsRepository) {}

  public mapToDto = (restaurant: Restaurant): RestaurantDto => {
    let parsedImages: string[] = [];
    if (restaurant.images) {
      try {
        parsedImages = JSON.parse(restaurant.images);
      } catch {
        parsedImages = [restaurant.images];
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
    };
  };

  public async getRestaurants(query: RestaurantFilterQuery): Promise<{
    data: RestaurantDto[];
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

  public async getFeaturedRestaurants(limit = 6): Promise<RestaurantDto[]> {
    const items = await this.repository.findFeatured(limit);
    return items.map(this.mapToDto);
  }

  public async getRestaurantByIdOrSlug(idOrSlug: string): Promise<RestaurantDto> {
    const item = await this.repository.findByIdOrSlug(idOrSlug);
    if (!item) {
      throw new NotFoundError(`Restaurant '${idOrSlug}' not found`, 'RESTAURANT_NOT_FOUND');
    }
    return this.mapToDto(item);
  }
}

export const restaurantsService = new RestaurantsService();
