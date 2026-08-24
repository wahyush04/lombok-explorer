import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { ErrorCode, HttpStatus, HttpStatusCode } from '../constants';
import { ApiErrorResponse } from '../types';
import { logger } from '../utils/logger';
import { config } from '../../config/config';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR;
  let message = 'Internal server error occurred';
  let details: string[] | null = null;

  // 1. Handled AppError hierarchy (Custom errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  }
  // 2. Handled Zod validation error
  else if (err instanceof ZodError) {
    statusCode = HttpStatus.BAD_REQUEST;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = 'Validation error occurred';
    details = err.errors.map((e) =>
      e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message,
    );
  }
  // 3. Handled Prisma Database Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = HttpStatus.CONFLICT;
        errorCode = ErrorCode.CONFLICT;
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        message = `Unique constraint failed on: ${target}`;
        break;
      }
      case 'P2025': {
        statusCode = HttpStatus.NOT_FOUND;
        errorCode = ErrorCode.NOT_FOUND;
        message = 'The requested database record was not found';
        break;
      }
      case 'P2003': {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.BAD_REQUEST;
        message = 'Foreign key constraint failed on related record';
        break;
      }
      default: {
        statusCode = HttpStatus.BAD_REQUEST;
        errorCode = ErrorCode.DATABASE_ERROR;
        message = `Database operation error: ${err.code}`;
        break;
      }
    }
  }
  // 4. JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    errorCode = ErrorCode.UNAUTHORIZED;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = HttpStatus.UNAUTHORIZED;
    errorCode = ErrorCode.UNAUTHORIZED;
    message = 'Authentication token has expired';
  }
  // 5. Body Parser Payload Too Large & Malformed JSON Errors
  else if (
    (err as unknown as { type?: string }).type === 'entity.too.large' ||
    (err as unknown as { status?: number }).status === HttpStatus.PAYLOAD_TOO_LARGE
  ) {
    statusCode = HttpStatus.PAYLOAD_TOO_LARGE;
    errorCode = ErrorCode.PAYLOAD_TOO_LARGE;
    message = 'Request payload exceeds maximum permitted size limit';
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = HttpStatus.BAD_REQUEST;
    errorCode = ErrorCode.BAD_REQUEST;
    message = 'Malformed JSON in request body';
  }
  // 6. Unhandled / Unexpected Errors
  else {
    message = config.app.isProduction ? 'Internal server error occurred' : err.message;
  }

  // Log error with contextual information
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        statusCode,
      },
      '💥 Unhandled Server Exception',
    );
  } else {
    logger.warn(
      {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        errorCode,
        message,
        details,
      },
      `⚠️ Client Error (${statusCode})`,
    );
  }

  const responsePayload: ApiErrorResponse = {
    success: false,
    message,
    errorCode,
    ...(details && details.length > 0 && { details }),
  };

  res.status(statusCode).json(responsePayload);
};
