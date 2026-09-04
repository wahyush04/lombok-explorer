import { z } from 'zod';
import { ReportReasonEnum } from '../../../feeds/dto/feed-report.dto';

export const ReportStatusEnum = z.enum(['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']);

export const PostStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED']);

export const AdminReportFilterQuerySchema = z.object({
  status: ReportStatusEnum.optional(),
  reason: ReportReasonEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

export const AdminUpdateReportStatusSchema = z.object({
  status: ReportStatusEnum,
  adminNotes: z.string().trim().max(1000, 'Admin notes cannot exceed 1000 characters').optional(),
});

export const AdminUpdatePostStatusSchema = z.object({
  status: PostStatusEnum,
  adminNotes: z.string().trim().max(1000, 'Admin notes cannot exceed 1000 characters').optional(),
});

export type AdminReportFilterQuery = z.infer<typeof AdminReportFilterQuerySchema>;
export type AdminUpdateReportStatusDto = z.infer<typeof AdminUpdateReportStatusSchema>;
export type AdminUpdatePostStatusDto = z.infer<typeof AdminUpdatePostStatusSchema>;

export interface AdminReportListItemDto {
  id: string;
  postId: string;
  post: {
    id: string;
    title: string;
    description: string;
    status: string;
    author: {
      id: string;
      name: string;
      username: string;
    };
  };
  reporter: {
    id: string;
    name: string;
    username: string;
  };
  reason: string;
  description: string | null;
  status: string;
  adminNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
