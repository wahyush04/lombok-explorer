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
    const { data, meta } = await this.service.getUserFavorites(userId, query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching favorite destinations');
  });

  public addFavorite = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const destinationId = req.params.destinationId as string;
    const data = await this.service.addFavorite(userId, destinationId);
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
    const result = await this.service.toggleFavorite(userId, destinationId);
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
}

export const favoritesController = new FavoritesController();
