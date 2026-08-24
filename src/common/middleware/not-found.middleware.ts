import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/app-error';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
