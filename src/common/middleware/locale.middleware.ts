import { Request, Response, NextFunction } from 'express';
import { resolveLocale } from '../../i18n/locale-resolver';

export const localeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const acceptLanguage = req.headers['accept-language'];
  const locale = resolveLocale(typeof acceptLanguage === 'string' ? acceptLanguage : undefined);

  req.locale = locale;
  res.setHeader('Vary', 'Accept-Language');

  next();
};
