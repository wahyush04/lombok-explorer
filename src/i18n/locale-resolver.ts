import { DEFAULT_LOCALE, SUPPORTED_LOCALES, SupportedLocale } from './types';

interface LocaleCandidate {
  locale: string;
  q: number;
}

/**
 * Normalizes a raw language or locale string to a supported canonical locale.
 * Example:
 * - 'id', 'in', 'id-id', 'id_id' -> 'id-ID'
 * - 'en', 'en-us', 'en_us', 'en-gb' -> 'en-US'
 */
export function normalizeLocale(rawTag: string): SupportedLocale | null {
  if (!rawTag) return null;
  const cleaned = rawTag.trim().toLowerCase().replace('_', '-');

  // Exact matches
  if (cleaned === 'id-id' || cleaned === 'id' || cleaned === 'in') {
    return 'id-ID';
  }
  if (cleaned === 'en-us' || cleaned === 'en' || cleaned.startsWith('en-')) {
    return 'en-US';
  }

  // Check against SUPPORTED_LOCALES
  for (const supported of SUPPORTED_LOCALES) {
    if (supported.toLowerCase() === cleaned) {
      return supported;
    }
  }

  return null;
}

/**
 * Parses an Accept-Language header string according to RFC 2616,
 * sorting by quality value (q-factor) and returning the best matching SupportedLocale.
 *
 * Example input: "en-US,en;q=0.9,id-ID;q=0.8"
 */
export function resolveLocale(acceptLanguageHeader?: string | null): SupportedLocale {
  if (!acceptLanguageHeader || typeof acceptLanguageHeader !== 'string') {
    return DEFAULT_LOCALE;
  }

  const items = acceptLanguageHeader.split(',');
  const candidates: LocaleCandidate[] = [];

  for (const item of items) {
    const parts = item.trim().split(';');
    const tag = parts[0]?.trim();
    if (!tag) continue;

    let q = 1.0;
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const rawParam = parts[i];
        if (!rawParam) continue;
        const param = rawParam.trim();
        if (param.startsWith('q=')) {
          const parsedQ = parseFloat(param.substring(2));
          if (!isNaN(parsedQ) && parsedQ >= 0 && parsedQ <= 1) {
            q = parsedQ;
          }
        }
      }
    }

    candidates.push({ locale: tag, q });
  }

  // Sort descending by quality value
  candidates.sort((a, b) => b.q - a.q);

  for (const candidate of candidates) {
    if (candidate.locale === '*') {
      return DEFAULT_LOCALE;
    }
    const normalized = normalizeLocale(candidate.locale);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_LOCALE;
}
