import { DEFAULT_LOCALE, SupportedLocale, TranslationParams, TranslationDictionary } from './types';
import { commonId } from './locales/id-ID/common';
import { authId } from './locales/id-ID/auth';
import { validationId } from './locales/id-ID/validation';
import { destinationId } from './locales/id-ID/destination';
import { feedId } from './locales/id-ID/feed';
import { notificationId } from './locales/id-ID/notification';

import { commonEn } from './locales/en-US/common';
import { authEn } from './locales/en-US/auth';
import { validationEn } from './locales/en-US/validation';
import { destinationEn } from './locales/en-US/destination';
import { feedEn } from './locales/en-US/feed';
import { notificationEn } from './locales/en-US/notification';

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  'id-ID': {
    ...commonId,
    ...authId,
    ...validationId,
    ...destinationId,
    ...feedId,
    ...notificationId,
  },
  'en-US': {
    ...commonEn,
    ...authEn,
    ...validationEn,
    ...destinationEn,
    ...feedEn,
    ...notificationEn,
  },
};

export class I18nService {
  /**
   * Translates a message code into the target locale string, interpolating any parameters.
   * Falls back to DEFAULT_LOCALE ('id-ID') if the key is missing in the target locale.
   * If missing in both, returns the code or default fallback string.
   */
  public static translate(
    code: string,
    locale: SupportedLocale = DEFAULT_LOCALE,
    params?: TranslationParams,
  ): string {
    const targetDict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
    const defaultDict = dictionaries[DEFAULT_LOCALE];

    let template = targetDict[code] || defaultDict[code];

    if (!template) {
      // If code not in dictionary, return the code itself as readable fallback
      template = code;
    }

    if (params) {
      return this.interpolate(template, params);
    }

    return template;
  }

  /**
   * Replaces placeholders formatted as {paramName} with corresponding values
   */
  private static interpolate(template: string, params: TranslationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        return String(params[key]);
      }
      return match;
    });
  }
}
