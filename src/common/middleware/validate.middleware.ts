import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodIssue, ZodTypeAny } from 'zod';
import { ValidationError } from '../errors/app-error';
import { FieldValidationError } from '../types';
import { I18nService } from '../../i18n/i18n.service';

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Maps a Zod issue into a stable error code and extracts parameters for localization.
 */
function mapZodIssueToCodeAndParams(issue: ZodIssue): {
  code: string;
  params: Record<string, string | number>;
} {
  const field = issue.path.join('.') || 'field';

  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined') {
        return { code: 'REQUIRED_FIELD', params: { field } };
      }
      return { code: 'INVALID_TYPE', params: { field, expected: issue.expected, received: issue.received } };

    case 'invalid_string':
      if (issue.validation === 'email') {
        return { code: 'INVALID_EMAIL', params: { field } };
      }
      if (issue.validation === 'uuid') {
        return { code: 'INVALID_UUID', params: { field } };
      }
      if (issue.validation === 'url') {
        return { code: 'INVALID_URL', params: { field } };
      }
      return { code: 'INVALID_FORMAT', params: { field } };

    case 'too_small':
      if (issue.type === 'string') {
        return { code: 'MIN_LENGTH', params: { field, min: issue.minimum.toString() } };
      }
      return { code: 'MIN_VALUE', params: { field, min: issue.minimum.toString() } };

    case 'too_big':
      if (issue.type === 'string') {
        return { code: 'MAX_LENGTH', params: { field, max: issue.maximum.toString() } };
      }
      return { code: 'MAX_VALUE', params: { field, max: issue.maximum.toString() } };

    case 'invalid_enum_value':
      return { code: 'INVALID_ENUM', params: { field } };

    default:
      return { code: 'INVALID_FIELD', params: { field } };
  }
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
        const locale = req.locale;

        const fieldErrors: FieldValidationError[] = error.errors.map((issue) => {
          const field = issue.path.join('.') || 'field';
          const { code, params } = mapZodIssueToCodeAndParams(issue);
          const localizedMsg = I18nService.translate(code, locale, params);
          // If translation found, use localized message; otherwise fallback to issue.message
          const message = localizedMsg !== code ? localizedMsg : issue.message;

          return {
            field,
            code,
            message,
          };
        });

        const details = fieldErrors.map((fe) => `${fe.field}: ${fe.message}`);
        const mainMessage = I18nService.translate('VALIDATION_ERROR', locale);

        next(new ValidationError(mainMessage, details, 'VALIDATION_ERROR', fieldErrors));
        return;
      }
      next(error);
    }
  };
};
