import { Response } from 'express';
import { HttpStatus, HttpStatusCode } from '../constants';
import { ApiActionResponse, ApiListResponse, ApiResponse, PaginationMeta } from '../types';

export class ResponseUtil {
  public static sendSuccess<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode: HttpStatusCode = HttpStatus.OK,
    meta?: PaginationMeta,
  ): Response<ApiResponse<T>> {
    const payload: ApiResponse<T> = {
      success: true,
      message,
      data,
      ...(meta && { meta }),
    };

    return res.status(statusCode).json(payload);
  }

  public static sendCreated<T>(
    res: Response,
    data: T,
    message = 'Resource created successfully',
  ): Response<ApiResponse<T>> {
    return this.sendSuccess(res, data, message, HttpStatus.CREATED);
  }

  public static sendPaginated<T>(
    res: Response,
    data: T[],
    meta: PaginationMeta,
    message = 'Success fetching data',
  ): Response<ApiListResponse<T>> {
    const payload: ApiListResponse<T> = {
      success: true,
      message,
      data,
      meta,
    };

    return res.status(HttpStatus.OK).json(payload);
  }

  public static sendActionSuccess(
    res: Response,
    message = 'Operation completed successfully',
    statusCode: HttpStatusCode = HttpStatus.OK,
  ): Response<ApiActionResponse> {
    const payload: ApiActionResponse = {
      success: true,
      message,
    };

    return res.status(statusCode).json(payload);
  }
}
