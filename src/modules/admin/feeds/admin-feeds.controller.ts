import { Request, Response } from 'express';
import { adminFeedsService, AdminFeedsService } from './admin-feeds.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { HttpStatus } from '../../../common/constants';
import {
  AdminReportFilterQuery,
  AdminUpdatePostStatusDto,
  AdminUpdateReportStatusDto,
} from './dto/admin-feed.dto';

export class AdminFeedsController {
  public getAllPosts = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, search, status } = req.query as any;
    const { data, meta } = await this.service.getAllPosts({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search as string,
      status: status as any,
    });
    ResponseUtil.sendPaginated(res, data, meta, 'Community feed posts retrieved successfully');
  };

  public getAllComments = async (req: Request, res: Response): Promise<void> => {
    const { page, limit, search } = req.query as any;
    const { data, meta } = await this.service.getAllComments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search as string,
    });
    ResponseUtil.sendPaginated(res, data, meta, 'Community comments retrieved successfully');
  };

  public deleteComment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.service.deleteComment(id as string);
    ResponseUtil.sendActionSuccess(res, 'Comment deleted successfully');
  };

  constructor(private readonly service: AdminFeedsService = adminFeedsService) {}

  public getReports = async (req: Request, res: Response): Promise<Response> => {
    const query = req.query as unknown as AdminReportFilterQuery;
    const { data, meta } = await this.service.getReports(query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Feed post reports retrieved successfully');
  };

  public getReportById = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const data = await this.service.getReportById(id);
    return ResponseUtil.sendSuccess(
      res,
      data,
      'Feed post report detail retrieved successfully',
      HttpStatus.OK,
    );
  };

  public updateReportStatus = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const body = req.body as AdminUpdateReportStatusDto;
    const adminId = req.user?.userId;
    const data = await this.service.updateReportStatus(id, body, adminId);
    return ResponseUtil.sendSuccess(res, data, 'Report status updated successfully', HttpStatus.OK);
  };

  public updatePostStatus = async (req: Request, res: Response): Promise<Response> => {
    const postId = String(req.params.id);
    const body = req.body as AdminUpdatePostStatusDto;
    const adminId = req.user?.userId;
    const data = await this.service.updatePostStatus(postId, body, adminId);
    return ResponseUtil.sendSuccess(
      res,
      data,
      'Feed post status updated successfully',
      HttpStatus.OK,
    );
  };
}

export const adminFeedsController = new AdminFeedsController();
