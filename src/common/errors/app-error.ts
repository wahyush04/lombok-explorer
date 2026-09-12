import { ErrorCode, HttpStatus, HttpStatusCode } from '../constants';

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details: string[] | null;
  public readonly data?: any;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR,
    details: string[] | null = null,
    isOperational = true,
    data?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    this.data = data;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = 'Bad Request',
    errorCode: string = ErrorCode.BAD_REQUEST,
    details: string[] | null = null,
    data?: any,
  ) {
    super(message, HttpStatus.BAD_REQUEST, errorCode, details, true, data);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Unauthorized access, please login',
    errorCode: string = ErrorCode.UNAUTHORIZED,
    details: string[] | null = null,
    data?: any,
  ) {
    super(message, HttpStatus.UNAUTHORIZED, errorCode, details, true, data);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = 'Access forbidden',
    errorCode: string = ErrorCode.FORBIDDEN,
    details: string[] | null = null,
    data?: any,
  ) {
    super(message, HttpStatus.FORBIDDEN, errorCode, details, true, data);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = 'Resource not found',
    errorCode: string = ErrorCode.NOT_FOUND,
    details: string[] | null = null,
    data?: any,
  ) {
    super(message, HttpStatus.NOT_FOUND, errorCode, details, true, data);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict',
    errorCode: string = ErrorCode.CONFLICT,
    details: string[] | null = null,
    data?: any,
  ) {
    super(message, HttpStatus.CONFLICT, errorCode, details, true, data);
  }
}

import { FieldValidationError } from '../types';

export class ValidationError extends AppError {
  public readonly fieldErrors?: FieldValidationError[];

  constructor(
    message = 'Validation failed',
    details: string[] | null = null,
    errorCode: string = ErrorCode.VALIDATION_ERROR,
    fieldErrors?: FieldValidationError[],
    data?: any,
  ) {
    super(message, HttpStatus.BAD_REQUEST, errorCode, details, true, data);
    this.fieldErrors = fieldErrors;
  }
}

export class InternalServerError extends AppError {
  constructor(
    message = 'Internal server error occurred',
    errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR,
    details: string[] | null = null,
  ) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, errorCode, details, false);
  }
}
