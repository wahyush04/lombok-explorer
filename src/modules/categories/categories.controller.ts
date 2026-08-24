import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { categoriesService, CategoriesService } from './categories.service';
import { CategoryDestinationsQuery } from './dto/category.dto';

export class CategoriesController {
  constructor(private readonly service: CategoriesService = categoriesService) {}

  public getCategories = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.service.getCategories();
    return ResponseUtil.sendSuccess(res, data, 'Success fetching categories');
  });

  public getByIdOrSlug = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const category = await this.service.getCategoryByIdOrSlug(id);
    return ResponseUtil.sendSuccess(res, category, 'Success fetching category detail');
  });

  public getCategoryDestinations = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const query = req.query as unknown as CategoryDestinationsQuery;
    const { data, meta } = await this.service.getCategoryDestinations(id, query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching category destinations');
  });
}

export const categoriesController = new CategoriesController();
