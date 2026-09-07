import { Request, Response } from 'express';
import { HttpStatus, HttpStatusCode } from '../constants';
import { ApiActionResponse, ApiListResponse, ApiResponse, PaginationMeta } from '../types';
import { I18nService } from '../../i18n/i18n.service';
import { TranslationParams } from '../../i18n/types';

export class ResponseUtil {
  public static sendSuccess<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode: HttpStatusCode = HttpStatus.OK,
    meta?: PaginationMeta,
    code = 'SUCCESS',
  ): Response<ApiResponse<T>> {
    const payload: ApiResponse<T> = {
      success: true,
      code,
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
    code = 'RESOURCE_CREATED',
  ): Response<ApiResponse<T>> {
    return this.sendSuccess(res, data, message, HttpStatus.CREATED, undefined, code);
  }

  public static sendPaginated<T>(
    res: Response,
    data: T[],
    meta: PaginationMeta,
    message = 'Success fetching data',
    code = 'SUCCESS',
  ): Response<ApiListResponse<T>> {
    const payload: ApiListResponse<T> = {
      success: true,
      code,
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
    code = 'SUCCESS',
  ): Response<ApiActionResponse> {
    const payload: ApiActionResponse = {
      success: true,
      code,
      message,
    };

    return res.status(statusCode).json(payload);
  }

  // ==========================================
  // LOCALIZED RESPONSE HELPERS
  // ==========================================

  public static sendLocalizedSuccess<T>(
    req: Request,
    res: Response,
    data: T,
    code: string,
    params?: TranslationParams,
    statusCode: HttpStatusCode = HttpStatus.OK,
    meta?: PaginationMeta,
  ): Response<ApiResponse<T>> {
    const message = I18nService.translate(code, req.locale, params);
    return this.sendSuccess(res, data, message, statusCode, meta, code);
  }

  public static sendLocalizedPaginated<T>(
    req: Request,
    res: Response,
    data: T[],
    meta: PaginationMeta,
    code: string,
    params?: TranslationParams,
  ): Response<ApiListResponse<T>> {
    const message = I18nService.translate(code, req.locale, params);
    return this.sendPaginated(res, data, meta, message, code);
  }

  public static sendLocalizedCreated<T>(
    req: Request,
    res: Response,
    data: T,
    code: string,
    params?: TranslationParams,
  ): Response<ApiResponse<T>> {
    const message = I18nService.translate(code, req.locale, params);
    return this.sendSuccess(res, data, message, HttpStatus.CREATED, undefined, code);
  }

  public static sendLocalizedAction(
    req: Request,
    res: Response,
    code: string,
    params?: TranslationParams,
    statusCode: HttpStatusCode = HttpStatus.OK,
  ): Response<ApiActionResponse> {
    const message = I18nService.translate(code, req.locale, params);
    return this.sendActionSuccess(res, message, statusCode, code);
  }
}
