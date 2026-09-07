export type SupportedLocale = 'id-ID' | 'en-US';

export const DEFAULT_LOCALE: SupportedLocale = 'id-ID';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['id-ID', 'en-US'] as const;

export interface TranslationParams {
  [key: string]: string | number;
}

export type TranslationDictionary = Record<string, string>;
