import { Request, Response } from 'express';
import { adminCategoriesService, AdminCategoriesService } from './admin-categories.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminCategoryFilterQuery,
  CreateCategoryDto,
  DeleteCategoryQuery,
  UpdateCategoryDto,
} from './dto/admin-category.dto';

export class AdminCategoriesController {
  constructor(private readonly service: AdminCategoriesService = adminCategoriesService) {}

  public getCategories = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminCategoryFilterQuery;
    const { data, meta } = await this.service.getCategories(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Categories retrieved successfully');
  };

  public getCategoryById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getCategoryByIdOrSlug(id as string);
    ResponseUtil.sendSuccess(res, data, 'Category details retrieved successfully');
  };

  public createCategory = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateCategoryDto;
    const data = await this.service.createCategory(
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendCreated(res, data, 'Category created successfully');
  };

  public updateCategory = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateCategoryDto;
    const data = await this.service.updateCategory(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'Category updated successfully');
  };

  public deleteCategory = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const query = req.query as unknown as DeleteCategoryQuery;
    await this.service.deleteCategory(
      id as string,
      query,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'Category deleted successfully');
  };
}

export const adminCategoriesController = new AdminCategoriesController();
