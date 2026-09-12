export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  currentPage?: number;
  totalCount?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

import { SupportedLocale } from '../../i18n/types';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  currentPage?: number;
  totalCount?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: true;
  code?: string;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiListResponse<T> {
  success: true;
  code?: string;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

export interface FieldValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  errorCode: string;
  message: string;
  data?: any;
  errors?: FieldValidationError[];
  details?: string[] | null;
}

export interface ApiActionResponse {
  success: true;
  code?: string;
  message: string;
}

export interface AuthUserPayload {
  userId: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      user?: AuthUserPayload;
      locale?: SupportedLocale;
    }
  }
}

