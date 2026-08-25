import {
  adminAuditLogsRepository,
  AdminAuditLogsRepository,
  AuditLogWithUser,
} from './admin-audit-logs.repository';
import { AdminAuditLogDto, AdminAuditLogFilterQuery } from './dto/admin-audit-log.dto';
import { NotFoundError } from '../../../common/errors/app-error';
import { PaginationMeta } from '../../../common/types';

export class AdminAuditLogsService {
  constructor(private readonly repository: AdminAuditLogsRepository = adminAuditLogsRepository) {}

  public async getAuditLogs(query: AdminAuditLogFilterQuery): Promise<{
    data: AdminAuditLogDto[];
    meta: PaginationMeta;
  }> {
    const { items, total } = await this.repository.findMany(query);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map((item) => this.mapToAdminDto(item)),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  public async getAuditLogById(id: string): Promise<AdminAuditLogDto> {
    const auditLog = await this.repository.findById(id);
    if (!auditLog) {
      throw new NotFoundError(`Audit log '${id}' not found`, 'AUDIT_LOG_NOT_FOUND');
    }
    return this.mapToAdminDto(auditLog);
  }

  public async recordLog(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: unknown;
    newValues?: unknown;
    details?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.repository.create(data);
  }

  private mapToAdminDto(item: AuditLogWithUser): AdminAuditLogDto {
    return {
      id: item.id,
      userId: item.userId,
      user: item.user
        ? {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
            role: item.user.role,
            avatarUrl: item.user.avatarUrl,
          }
        : null,
      action: item.action,
      resource: item.entity,
      resourceId: item.entityId,
      entity: item.entity,
      entityId: item.entityId,
      before: this.tryParseJson(item.oldValues),
      after: this.tryParseJson(item.newValues),
      details: this.tryParseJson(item.details),
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      createdAt: item.createdAt.toISOString(),
      timestamp: item.createdAt.toISOString(),
    };
  }

  private tryParseJson(value: string | null | undefined): Record<string, unknown> | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : { value: parsed };
    } catch {
      return { raw: value };
    }
  }
}

export const adminAuditLogsService = new AdminAuditLogsService();
