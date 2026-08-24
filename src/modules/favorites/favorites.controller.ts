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
    const destinationId = req.params.destinationId as string;
    await this.service.removeFavorite(userId, destinationId);
    return ResponseUtil.sendActionSuccess(res, 'Destination removed from favorites successfully');
  });
}

export const favoritesController = new FavoritesController();
