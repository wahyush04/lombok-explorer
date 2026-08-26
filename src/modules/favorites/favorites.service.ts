import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { favoritesRepository, FavoritesRepository } from './favorites.repository';
import {
  destinationsRepository,
  DestinationsRepository,
} from '../destinations/destinations.repository';
import { destinationsService, DestinationsService } from '../destinations/destinations.service';
import { FavoriteQuery } from './dto/favorite.dto';
import { DestinationDto } from '../destinations/dto/destination.dto';
import { PaginationMeta } from '../../common/types';

export class FavoritesService {
  constructor(
    private readonly repository: FavoritesRepository = favoritesRepository,
    private readonly destRepository: DestinationsRepository = destinationsRepository,
    private readonly destService: DestinationsService = destinationsService,
  ) {}

  public async getUserFavorites(
    userId: string,
    query: FavoriteQuery,
  ): Promise<{ data: DestinationDto[]; meta: PaginationMeta }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const { items, total } = await this.repository.getUserFavorites(userId, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;

    const data: DestinationDto[] = items.map((fav: (typeof items)[number]) =>
      this.destService.mapToDto(fav.destination, true),
    );

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

  public async addFavorite(userId: string, destinationIdOrSlug: string): Promise<DestinationDto> {
    // 1. Resolve destination
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    // 2. Check for duplicate favorite
    const existing = await this.repository.findFavorite(userId, destination.id);
    if (existing) {
      throw new ConflictError('Destination is already in your favorites', 'DUPLICATE_FAVORITE');
    }

    // 3. Add to database
    const created = await this.repository.addFavorite(userId, destination.id);
    return this.destService.mapToDto(created.destination, true);
  }

  public async removeFavorite(userId: string, destinationIdOrSlug: string): Promise<void> {
    // 1. Resolve destination
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    // 2. Check if favorite exists
    const existing = await this.repository.findFavorite(userId, destination.id);
    if (!existing) {
      throw new NotFoundError('This destination is not in your favorites', 'FAVORITE_NOT_FOUND');
    }

    // 3. Remove favorite
    await this.repository.removeFavorite(userId, destination.id);
  }

  public async toggleFavorite(
    userId: string,
    destinationIdOrSlug: string,
  ): Promise<{
    isFavorite: boolean;
    destinationId: string;
    destinationName: string;
    destination: DestinationDto;
    message: string;
  }> {
    // 1. Resolve destination
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    // 2. Check if already favorited
    const existing = await this.repository.findFavorite(userId, destination.id);

    if (existing) {
      // Remove favorite
      await this.repository.removeFavorite(userId, destination.id);
      const dto = this.destService.mapToDto(destination, false);
      return {
        isFavorite: false,
        destinationId: destination.id,
        destinationName: destination.name,
        destination: dto,
        message: 'Destination removed from favorites successfully',
      };
    } else {
      // Add favorite
      const created = await this.repository.addFavorite(userId, destination.id);
      const dto = this.destService.mapToDto(created.destination, true);
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
}

export const favoritesService = new FavoritesService();
