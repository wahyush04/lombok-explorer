export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiListResponse<T> {
  success: true;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode: string;
  details?: string[] | null;
}

export interface ApiActionResponse {
  success: true;
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
    }
  }
}
