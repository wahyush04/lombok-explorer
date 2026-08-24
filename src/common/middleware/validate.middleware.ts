import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '../errors/app-error';

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schema: RequestValidationSchema | ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schema) {
        req.body = await schema.parseAsync(req.body);
      } else {
        if (schema.params) {
          req.params = await schema.params.parseAsync(req.params);
        }
        if (schema.query) {
          req.query = await schema.query.parseAsync(req.query);
        }
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => {
          const path = err.path.join('.');
          return path ? `${path}: ${err.message}` : err.message;
        });

        next(new ValidationError('Invalid request parameters or payload', details));
        return;
      }
      next(error);
    }
  };
};
