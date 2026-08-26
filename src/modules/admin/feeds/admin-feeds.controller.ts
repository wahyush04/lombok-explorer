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
  constructor(private readonly service: AdminFeedsService = adminFeedsService) {}

  public getReports = async (req: Request, res: Response): Promise<Response> => {
    const query = req.query as unknown as AdminReportFilterQuery;
    const { data, meta } = await this.service.getReports(query);
    return ResponseUtil.sendPaginated(res, data, meta, 'Feed post reports retrieved successfully');
  };

  public getReportById = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const data = await this.service.getReportById(id);
    return ResponseUtil.sendSuccess(res, data, 'Feed post report detail retrieved successfully', HttpStatus.OK);
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
    return ResponseUtil.sendSuccess(res, data, 'Feed post status updated successfully', HttpStatus.OK);
  };
}

export const adminFeedsController = new AdminFeedsController();
