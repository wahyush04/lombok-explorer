import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { favoritesService, FavoritesService } from './favorites.service';
import { FavoriteQuery } from './dto/favorite.dto';

export class FavoritesController {
  constructor(private readonly service: FavoritesService = favoritesService) {}

  public getFavorites = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const query = req.query as unknown as FavoriteQuery;

    // If type is ALL, ACCOMMODATION, or RESTAURANT, return unified response
    if (query.type && query.type !== 'DESTINATION') {
      const { data, meta } = await this.service.getUserUnifiedFavorites(
        userId,
        query,
        req.locale,
      );
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('Vary', 'Authorization');
      return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching favorites');
    }

    // Default / Backward compatible: Destinations only
    const { data, meta } = await this.service.getUserFavorites(userId, query, req.locale);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Vary', 'Authorization');
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching favorite destinations');
  });

  public getUnifiedFavorites = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const query = req.query as unknown as FavoriteQuery;
    const { data, meta } = await this.service.getUserUnifiedFavorites(
      userId,
      query,
      req.locale,
    );

    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('Vary', 'Authorization');

    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching favorites');
  });

  // ==========================================
  // DESTINATION FAVORITES
  // ==========================================

  public addFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const destinationId = (req.params.destinationId || req.params.id) as string;
    const data = await this.service.addFavorite(userId, destinationId, req.locale);
    return ResponseUtil.sendCreated(res, data, 'Destination added to favorites successfully');
  });

  public removeFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const destinationId = (req.params.destinationId || req.params.id) as string;
    await this.service.removeFavorite(userId, destinationId);
    return ResponseUtil.sendActionSuccess(res, 'Destination removed from favorites successfully');
  });

  public toggleFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const destinationId = (req.params.id || req.params.destinationId) as string;
    const result = await this.service.toggleFavorite(userId, destinationId, req.locale);
    return ResponseUtil.sendSuccess(
      res,
      {
        destinationId: result.destinationId,
        destinationName: result.destinationName,
        isFavorite: result.isFavorite,
        destination: result.destination,
      },
      result.message,
    );
  });

  public getFavoriteStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const destinationId = (req.params.id || req.params.destinationId) as string;
    const result = await this.service.getFavoriteStatus(userId, destinationId);
    return ResponseUtil.sendSuccess(res, result, 'Success fetching favorite status');
  });

  // ==========================================
  // ACCOMMODATION FAVORITES
  // ==========================================

  public addAccommodationFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const accommodationId = (req.params.id || req.params.accommodationId) as string;
    const data = await this.service.addAccommodationFavorite(userId, accommodationId, req.locale);
    return ResponseUtil.sendCreated(res, data, 'Accommodation added to favorites successfully');
  });

  public removeAccommodationFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const accommodationId = (req.params.id || req.params.accommodationId) as string;
    await this.service.removeAccommodationFavorite(userId, accommodationId);
    return ResponseUtil.sendActionSuccess(res, 'Accommodation removed from favorites successfully');
  });

  public toggleAccommodationFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const accommodationId = (req.params.id || req.params.accommodationId) as string;
    const result = await this.service.toggleAccommodationFavorite(userId, accommodationId, req.locale);
    return ResponseUtil.sendSuccess(
      res,
      {
        accommodationId: result.accommodationId,
        accommodationName: result.accommodationName,
        isFavorite: result.isFavorite,
        accommodation: result.accommodation,
      },
      result.message,
    );
  });

  public getAccommodationFavoriteStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const accommodationId = (req.params.id || req.params.accommodationId) as string;
    const result = await this.service.getAccommodationFavoriteStatus(userId, accommodationId);
    return ResponseUtil.sendSuccess(res, result, 'Success fetching accommodation favorite status');
  });

  // ==========================================
  // RESTAURANT FAVORITES
  // ==========================================

  public addRestaurantFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const restaurantId = (req.params.id || req.params.restaurantId) as string;
    const data = await this.service.addRestaurantFavorite(userId, restaurantId, req.locale);
    return ResponseUtil.sendCreated(res, data, 'Restaurant added to favorites successfully');
  });

  public removeRestaurantFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const restaurantId = (req.params.id || req.params.restaurantId) as string;
    await this.service.removeRestaurantFavorite(userId, restaurantId);
    return ResponseUtil.sendActionSuccess(res, 'Restaurant removed from favorites successfully');
  });

  public toggleRestaurantFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const restaurantId = (req.params.id || req.params.restaurantId) as string;
    const result = await this.service.toggleRestaurantFavorite(userId, restaurantId, req.locale);
    return ResponseUtil.sendSuccess(
      res,
      {
        restaurantId: result.restaurantId,
        restaurantName: result.restaurantName,
        isFavorite: result.isFavorite,
        restaurant: result.restaurant,
      },
      result.message,
    );
  });

  public getRestaurantFavoriteStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const restaurantId = (req.params.id || req.params.restaurantId) as string;
    const result = await this.service.getRestaurantFavoriteStatus(userId, restaurantId);
    return ResponseUtil.sendSuccess(res, result, 'Success fetching restaurant favorite status');
  });
}

export const favoritesController = new FavoritesController();
