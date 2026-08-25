import { z } from 'zod';

export const AdminAuditLogFilterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  adminId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  resource: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  resourceId: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  createdFrom: z.string().trim().optional(),
  createdTo: z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'action', 'entity']).default('createdAt'),
  sort_by: z.enum(['createdAt', 'action', 'entity']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

export type AdminAuditLogFilterQuery = z.infer<typeof AdminAuditLogFilterQuerySchema>;

export interface AdminAuditLogUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface AdminAuditLogDto {
  id: string;
  userId: string | null;
  user: AdminAuditLogUserDto | null;
  action: string;
  resource: string;
  resourceId: string | null;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  timestamp: string;
}
