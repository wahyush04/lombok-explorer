import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { favoritesRepository, FavoritesRepository } from './favorites.repository';
import {
  destinationsRepository,
  DestinationsRepository,
} from '../destinations/destinations.repository';
import { destinationsService, DestinationsService } from '../destinations/destinations.service';
import {
  accommodationsRepository,
  AccommodationsRepository,
} from '../accommodations/accommodations.repository';
import {
  accommodationsService,
  AccommodationsService,
} from '../accommodations/accommodations.service';
import {
  restaurantsRepository,
  RestaurantsRepository,
} from '../restaurants/restaurants.repository';
import {
  restaurantsService,
  RestaurantsService,
} from '../restaurants/restaurants.service';
import {
  FavoriteQuery,
  UnifiedFavoriteItemDto,
  NormalizedFavoriteItem,
} from './dto/favorite.dto';
import { DestinationDto } from '../destinations/dto/destination.dto';
import { AccommodationDto } from '../accommodations/dto/accommodation.dto';
import { RestaurantDto } from '../restaurants/dto/restaurant.dto';
import { PaginationMeta } from '../../common/types';
import { DEFAULT_LOCALE } from '../../i18n/types';

export class FavoritesService {
  constructor(
    private readonly repository: FavoritesRepository = favoritesRepository,
    private readonly destRepository: DestinationsRepository = destinationsRepository,
    private readonly destService: DestinationsService = destinationsService,
    private readonly accRepository: AccommodationsRepository = accommodationsRepository,
    private readonly accService: AccommodationsService = accommodationsService,
    private readonly restRepository: RestaurantsRepository = restaurantsRepository,
    private readonly restService: RestaurantsService = restaurantsService,
  ) {}

  // ==========================================
  // UNIFIED FAVORITES
  // ==========================================

  public async getUserUnifiedFavorites(
    userId: string,
    query: FavoriteQuery,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{ data: UnifiedFavoriteItemDto[]; meta: PaginationMeta }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.getUserUnifiedFavorites(
      userId,
      query.type,
      page,
      limit,
    );
    const totalPages = Math.ceil(total / limit) || 1;

    const data: UnifiedFavoriteItemDto[] = [];

    for (const fav of items) {
      if (fav.type === 'DESTINATION' && fav.destination) {
        const destDto = this.destService.mapToDto(fav.destination, true, locale);
        const price = destDto.entranceFee || 0;
        const normalized: NormalizedFavoriteItem = {
          id: fav.destination.id,
          name: destDto.name,
          slug: destDto.slug,
          type: 'DESTINATION',
          rating: destDto.rating,
          reviewCount: destDto.reviewCount,
          coverImageUrl: destDto.coverImageUrl,
          images: destDto.images,
          region: destDto.region,
          address: destDto.address,
          price,
          priceFormatted: price > 0 ? `Rp ${price.toLocaleString('id-ID')}` : 'Gratis',
          isFavorite: true,
        };

        data.push({
          id: fav.id,
          userId: fav.userId,
          type: 'DESTINATION',
          createdAt: fav.createdAt,
          item: normalized,
          destination: destDto,
        });
      } else if (fav.type === 'ACCOMMODATION' && fav.accommodation) {
        const accDto = this.accService.mapToDto(fav.accommodation, true, locale);
        const price = accDto.pricePerNight || 0;
        const normalized: NormalizedFavoriteItem = {
          id: fav.accommodation.id,
          name: accDto.name,
          slug: accDto.slug,
          type: 'ACCOMMODATION',
          rating: accDto.rating,
          reviewCount: accDto.reviewCount,
          coverImageUrl: accDto.coverImageUrl,
          images: accDto.images,
          region: accDto.region,
          address: accDto.address,
          price,
          priceFormatted: `Rp ${price.toLocaleString('id-ID')}/malam`,
          isFavorite: true,
        };

        data.push({
          id: fav.id,
          userId: fav.userId,
          type: 'ACCOMMODATION',
          createdAt: fav.createdAt,
          item: normalized,
          accommodation: accDto,
        });
      } else if (fav.type === 'RESTAURANT' && fav.restaurant) {
        const restDto = this.restService.mapToDto(fav.restaurant, true, locale);
        const price = restDto.minPrice || 0;
        const normalized: NormalizedFavoriteItem = {
          id: fav.restaurant.id,
          name: restDto.name,
          slug: restDto.slug,
          type: 'RESTAURANT',
          rating: restDto.rating,
          reviewCount: restDto.reviewCount,
          coverImageUrl: restDto.coverImageUrl,
          images: restDto.images,
          region: restDto.region,
          address: restDto.address,
          price,
          priceFormatted: restDto.priceRange
            ? restDto.priceRange
            : price > 0
              ? `Rp ${price.toLocaleString('id-ID')} - Rp ${restDto.maxPrice.toLocaleString('id-ID')}`
              : undefined,
          isFavorite: true,
        };

        data.push({
          id: fav.id,
          userId: fav.userId,
          type: 'RESTAURANT',
          createdAt: fav.createdAt,
          item: normalized,
          restaurant: restDto,
        });
      }
    }

    return {
      data,
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

  // ==========================================
  // DESTINATION FAVORITES (BACKWARD COMPATIBLE)
  // ==========================================

  public async getUserFavorites(
    userId: string,
    query: FavoriteQuery,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{ data: DestinationDto[]; meta: PaginationMeta }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.getUserFavorites(userId, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;

    const data: DestinationDto[] = items
      .filter((fav) => fav.destination !== null && fav.destination !== undefined)
      .map((fav) => this.destService.mapToDto(fav.destination!, true, locale));

    return {
      data,
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

  public async addFavorite(
    userId: string,
    destinationIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<DestinationDto> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findFavorite(userId, destination.id);
    if (existing) {
      throw new ConflictError('Destination is already in your favorites', 'DUPLICATE_FAVORITE');
    }

    const created = await this.repository.addFavorite(userId, destination.id);
    return this.destService.mapToDto(created.destination!, true, locale);
  }

  public async removeFavorite(userId: string, destinationIdOrSlug: string): Promise<void> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findFavorite(userId, destination.id);
    if (!existing) {
      throw new NotFoundError('This destination is not in your favorites', 'FAVORITE_NOT_FOUND');
    }

    await this.repository.removeFavorite(userId, destination.id);
  }

  public async toggleFavorite(
    userId: string,
    destinationIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{
    isFavorite: boolean;
    destinationId: string;
    destinationName: string;
    destination: DestinationDto;
    message: string;
  }> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findFavorite(userId, destination.id);

    if (existing) {
      await this.repository.removeFavorite(userId, destination.id);
      const dto = this.destService.mapToDto(destination, false, locale);
      return {
        isFavorite: false,
        destinationId: destination.id,
        destinationName: destination.name,
        destination: dto,
        message: 'Destination removed from favorites successfully',
      };
    } else {
      const created = await this.repository.addFavorite(userId, destination.id);
      const dto = this.destService.mapToDto(created.destination!, true, locale);
      return {
        isFavorite: true,
        destinationId: destination.id,
        destinationName: destination.name,
        destination: dto,
        message: 'Destination added to favorites successfully',
      };
    }
  }

  public async getFavoriteStatus(
    userId: string,
    destinationIdOrSlug: string,
  ): Promise<{ isFavorite: boolean; destinationId: string; destinationName: string }> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findFavorite(userId, destination.id);
    return {
      isFavorite: Boolean(existing),
      destinationId: destination.id,
      destinationName: destination.name,
    };
  }

  // ==========================================
  // ACCOMMODATION FAVORITES
  // ==========================================

  public async addAccommodationFavorite(
    userId: string,
    accommodationIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<AccommodationDto> {
    const accommodation = await this.accRepository.findByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findAccommodationFavorite(userId, accommodation.id);
    if (existing) {
      throw new ConflictError('Accommodation is already in your favorites', 'DUPLICATE_FAVORITE');
    }

    const created = await this.repository.addAccommodationFavorite(userId, accommodation.id);
    return this.accService.mapToDto(created.accommodation!, true, locale);
  }

  public async removeAccommodationFavorite(
    userId: string,
    accommodationIdOrSlug: string,
  ): Promise<void> {
    const accommodation = await this.accRepository.findByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findAccommodationFavorite(userId, accommodation.id);
    if (!existing) {
      throw new NotFoundError('This accommodation is not in your favorites', 'FAVORITE_NOT_FOUND');
    }

    await this.repository.removeAccommodationFavorite(userId, accommodation.id);
  }

  public async toggleAccommodationFavorite(
    userId: string,
    accommodationIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{
    isFavorite: boolean;
    accommodationId: string;
    accommodationName: string;
    accommodation: AccommodationDto;
    message: string;
  }> {
    const accommodation = await this.accRepository.findByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findAccommodationFavorite(userId, accommodation.id);

    if (existing) {
      await this.repository.removeAccommodationFavorite(userId, accommodation.id);
      const dto = this.accService.mapToDto(accommodation, false, locale);
      return {
        isFavorite: false,
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        accommodation: dto,
        message: 'Accommodation removed from favorites successfully',
      };
    } else {
      const created = await this.repository.addAccommodationFavorite(userId, accommodation.id);
      const dto = this.accService.mapToDto(created.accommodation!, true, locale);
      return {
        isFavorite: true,
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        accommodation: dto,
        message: 'Accommodation added to favorites successfully',
      };
    }
  }

  public async getAccommodationFavoriteStatus(
    userId: string,
    accommodationIdOrSlug: string,
  ): Promise<{ isFavorite: boolean; accommodationId: string; accommodationName: string }> {
    const accommodation = await this.accRepository.findByIdOrSlug(accommodationIdOrSlug);
    if (!accommodation) {
      throw new NotFoundError(
        `Accommodation '${accommodationIdOrSlug}' not found`,
        'ACCOMMODATION_NOT_FOUND',
      );
    }

    const existing = await this.repository.findAccommodationFavorite(userId, accommodation.id);
    return {
      isFavorite: Boolean(existing),
      accommodationId: accommodation.id,
      accommodationName: accommodation.name,
    };
  }

  // ==========================================
  // RESTAURANT FAVORITES
  // ==========================================

  public async addRestaurantFavorite(
    userId: string,
    restaurantIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<RestaurantDto> {
    const restaurant = await this.restRepository.findByIdOrSlug(restaurantIdOrSlug);
    if (!restaurant) {
      throw new NotFoundError(
        `Restaurant '${restaurantIdOrSlug}' not found`,
        'RESTAURANT_NOT_FOUND',
      );
    }

    const existing = await this.repository.findRestaurantFavorite(userId, restaurant.id);
    if (existing) {
      throw new ConflictError('Restaurant is already in your favorites', 'DUPLICATE_FAVORITE');
    }

    const created = await this.repository.addRestaurantFavorite(userId, restaurant.id);
    return this.restService.mapToDto(created.restaurant!, true, locale);
  }

  public async removeRestaurantFavorite(
    userId: string,
    restaurantIdOrSlug: string,
  ): Promise<void> {
    const restaurant = await this.restRepository.findByIdOrSlug(restaurantIdOrSlug);
    if (!restaurant) {
      throw new NotFoundError(
        `Restaurant '${restaurantIdOrSlug}' not found`,
        'RESTAURANT_NOT_FOUND',
      );
    }

    const existing = await this.repository.findRestaurantFavorite(userId, restaurant.id);
    if (!existing) {
      throw new NotFoundError('This restaurant is not in your favorites', 'FAVORITE_NOT_FOUND');
    }

    await this.repository.removeRestaurantFavorite(userId, restaurant.id);
  }

  public async toggleRestaurantFavorite(
    userId: string,
    restaurantIdOrSlug: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<{
    isFavorite: boolean;
    restaurantId: string;
    restaurantName: string;
    restaurant: RestaurantDto;
    message: string;
  }> {
    const restaurant = await this.restRepository.findByIdOrSlug(restaurantIdOrSlug);
    if (!restaurant) {
      throw new NotFoundError(
        `Restaurant '${restaurantIdOrSlug}' not found`,
        'RESTAURANT_NOT_FOUND',
      );
    }

    const existing = await this.repository.findRestaurantFavorite(userId, restaurant.id);

    if (existing) {
      await this.repository.removeRestaurantFavorite(userId, restaurant.id);
      const dto = this.restService.mapToDto(restaurant, false, locale);
      return {
        isFavorite: false,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurant: dto,
        message: 'Restaurant removed from favorites successfully',
      };
    } else {
      const created = await this.repository.addRestaurantFavorite(userId, restaurant.id);
      const dto = this.restService.mapToDto(created.restaurant!, true, locale);
      return {
        isFavorite: true,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurant: dto,
        message: 'Restaurant added to favorites successfully',
      };
    }
  }

  public async getRestaurantFavoriteStatus(
    userId: string,
    restaurantIdOrSlug: string,
  ): Promise<{ isFavorite: boolean; restaurantId: string; restaurantName: string }> {
    const restaurant = await this.restRepository.findByIdOrSlug(restaurantIdOrSlug);
    if (!restaurant) {
      throw new NotFoundError(
        `Restaurant '${restaurantIdOrSlug}' not found`,
        'RESTAURANT_NOT_FOUND',
      );
    }

    const existing = await this.repository.findRestaurantFavorite(userId, restaurant.id);
    return {
      isFavorite: Boolean(existing),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    };
  }
}

export const favoritesService = new FavoritesService();
