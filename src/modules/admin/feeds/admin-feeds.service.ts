import { adminFeedsRepository, AdminFeedsRepository } from './admin-feeds.repository';
import {
  AdminReportFilterQuery,
  AdminUpdatePostStatusDto,
  AdminUpdateReportStatusDto,
} from './dto/admin-feed.dto';
import { NotFoundError } from '../../../common/errors/app-error';
import { adminAuditLogsService } from '../audit-logs/admin-audit-logs.service';
import { PaginationMeta } from '../../../common/types';

export class AdminFeedsService {
  constructor(private readonly repository: AdminFeedsRepository = adminFeedsRepository) {}

  public async getReports(query: AdminReportFilterQuery): Promise<{
    data: unknown[];
    meta: PaginationMeta;
  }> {
    const { items, total, page, limit } = await this.repository.findReports(query);
    const totalPages = Math.ceil(total / limit) || 1;

    const data = items.map((r: any) => ({
      id: r.id,
      postId: r.postId,
      post: r.post
        ? {
            id: r.post.id,
            title: r.post.title,
            description: r.post.description,
            status: r.post.status,
            author: {
              id: r.post.user?.id || '',
              name: r.post.user?.name || '',
              username: r.post.user?.username || r.post.user?.email.split('@')[0] || 'user',
            },
          }
        : null,
      reporter: {
        id: r.user.id,
        name: r.user.name,
        username: r.user.username || r.user.email.split('@')[0] || 'user',
      },
      reason: r.reason,
      description: r.description,
      status: r.status,
      adminNotes: r.adminNotes,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  public async getReportById(id: string) {
    const report = await this.repository.findReportById(id);
    if (!report) {
      throw new NotFoundError(`Post report with ID '${id}' not found`, 'REPORT_NOT_FOUND');
    }

    return {
      id: report.id,
      postId: report.postId,
      post: report.post
        ? {
            id: report.post.id,
            title: report.post.title,
            description: report.post.description,
            status: report.post.status,
            author: {
              id: report.post.user?.id || '',
              name: report.post.user?.name || '',
              username: report.post.user?.username || report.post.user?.email.split('@')[0] || 'user',
            },
            media: report.post.media,
            location: report.post.location,
          }
        : null,
      reporter: {
        id: report.user.id,
        name: report.user.name,
        username: report.user.username || report.user.email.split('@')[0] || 'user',
      },
      reason: report.reason,
      description: report.description,
      status: report.status,
      adminNotes: report.adminNotes,
      resolvedBy: report.resolvedBy,
      resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  public async updateReportStatus(
    id: string,
    data: AdminUpdateReportStatusDto,
    adminId?: string,
  ) {
    const existing = await this.repository.findReportById(id);
    if (!existing) {
      throw new NotFoundError(`Post report with ID '${id}' not found`, 'REPORT_NOT_FOUND');
    }

    const previousStatus = existing.status;
    const updated = await this.repository.updateReport(id, {
      status: data.status as any,
      adminNotes: data.adminNotes,
      resolvedBy: adminId,
    });

    if (adminId) {
      await adminAuditLogsService.recordLog({
        userId: adminId,
        action: 'UPDATE_REPORT_STATUS',
        entity: 'POST_REPORT',
        entityId: id,
        oldValues: { status: previousStatus },
        newValues: { status: data.status, adminNotes: data.adminNotes },
      });
    }

    return {
      id: updated.id,
      postId: updated.postId,
      status: updated.status,
      adminNotes: updated.adminNotes,
      resolvedBy: updated.resolvedBy,
      resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  public async updatePostStatus(
    postId: string,
    data: AdminUpdatePostStatusDto,
    adminId?: string,
  ) {
    const post = await this.repository.findPostById(postId);
    if (!post) {
      throw new NotFoundError(`Feed post with ID '${postId}' not found`, 'POST_NOT_FOUND');
    }

    const previousStatus = post.status;
    const updated = await this.repository.updatePostStatus(postId, data.status as any);

    if (adminId) {
      await adminAuditLogsService.recordLog({
        userId: adminId,
        action: 'UPDATE_FEED_POST_STATUS',
        entity: 'POST',
        entityId: postId,
        oldValues: { status: previousStatus },
        newValues: { status: data.status, adminNotes: data.adminNotes },
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      title: updated.title,
      deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const adminFeedsService = new AdminFeedsService();
