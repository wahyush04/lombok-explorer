import { DEFAULT_LOCALE } from './types';

export interface BaseTranslation {
  locale: string;
  [key: string]: any;
}

/**
 * Resolves localized field values from a translation array with field-level fallback:
 * 1. Requested locale translation (if field is non-empty)
 * 2. Default locale ('id-ID') translation (if field is non-empty)
 * 3. Parent entity canonical field value
 */
export function resolveLocalizedFields<
  T extends Record<string, any>,
  TR extends BaseTranslation = BaseTranslation,
>(
  requestedLocale: string = DEFAULT_LOCALE,
  translations: TR[] | undefined | null,
  fallbackEntity: T,
  localizedFieldNames: (keyof T)[],
): T {
  const reqTranslation = translations?.find((t) => t.locale === requestedLocale);
  const defTranslation = translations?.find((t) => t.locale === DEFAULT_LOCALE);

  const resolved = { ...fallbackEntity };

  for (const field of localizedFieldNames) {
    const fieldKey = field as string;
    const reqVal = reqTranslation ? reqTranslation[fieldKey] : undefined;
    const defVal = defTranslation ? defTranslation[fieldKey] : undefined;
    const parentVal = fallbackEntity[field];

    if (reqVal !== undefined && reqVal !== null && reqVal !== '') {
      resolved[field] = reqVal;
    } else if (defVal !== undefined && defVal !== null && defVal !== '') {
      resolved[field] = defVal;
    } else {
      resolved[field] = parentVal;
    }
  }

  return resolved;
}
