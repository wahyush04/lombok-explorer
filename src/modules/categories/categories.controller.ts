import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { categoriesService, CategoriesService } from './categories.service';
import { CategoryDestinationsQuery } from './dto/category.dto';

export class CategoriesController {
  constructor(private readonly service: CategoriesService = categoriesService) {}

  public getCategories = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.service.getCategories(req.locale);
    res.setHeader('Vary', 'Accept-Language');
    return ResponseUtil.sendLocalizedSuccess(req, res, data, 'CATEGORIES_RETRIEVED');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const category = await this.service.getCategoryByIdOrSlug(id, req.locale);
    res.setHeader('Vary', 'Accept-Language');
    return ResponseUtil.sendLocalizedSuccess(req, res, category, 'DATA_RETRIEVED');
  });

  public getCategoryDestinations = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const query = req.query as unknown as CategoryDestinationsQuery;
    const { data, meta } = await this.service.getCategoryDestinations(id, query, req.locale);
    res.setHeader('Vary', 'Accept-Language');
    return ResponseUtil.sendLocalizedPaginated(req, res, data, meta, 'DESTINATIONS_RETRIEVED');
  });
}

export const categoriesController = new CategoriesController();
