import { Request, Response } from 'express';
import { adminAuditLogsService, AdminAuditLogsService } from './admin-audit-logs.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { AdminAuditLogFilterQuery } from './dto/admin-audit-log.dto';

export class AdminAuditLogsController {
  constructor(private readonly service: AdminAuditLogsService = adminAuditLogsService) {}

  public getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminAuditLogFilterQuery;
    const { data, meta } = await this.service.getAuditLogs(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Audit logs retrieved successfully');
  };

  public getAuditLogById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getAuditLogById(id as string);
    ResponseUtil.sendSuccess(res, data, 'Audit log details retrieved successfully');
  };
}

export const adminAuditLogsController = new AdminAuditLogsController();
