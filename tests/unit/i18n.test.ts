import { describe, it, expect } from 'vitest';
import { normalizeLocale, resolveLocale } from '../../src/i18n/locale-resolver';
import { I18nService } from '../../src/i18n/i18n.service';
import { DEFAULT_LOCALE } from '../../src/i18n/types';

describe('I18n Locale Resolver', () => {
  it('should normalize Indonesian language variants to id-ID', () => {
    expect(normalizeLocale('id')).toBe('id-ID');
    expect(normalizeLocale('in')).toBe('id-ID');
    expect(normalizeLocale('id-id')).toBe('id-ID');
    expect(normalizeLocale('id_ID')).toBe('id-ID');
    expect(normalizeLocale('ID-ID')).toBe('id-ID');
  });

  it('should normalize English language variants to en-US', () => {
    expect(normalizeLocale('en')).toBe('en-US');
    expect(normalizeLocale('en-us')).toBe('en-US');
    expect(normalizeLocale('en_US')).toBe('en-US');
    expect(normalizeLocale('en-gb')).toBe('en-US');
    expect(normalizeLocale('en-AU')).toBe('en-US');
  });

  it('should return null for unsupported language variants', () => {
    expect(normalizeLocale('fr-FR')).toBeNull();
    expect(normalizeLocale('de')).toBeNull();
    expect(normalizeLocale('ja')).toBeNull();
  });

  it('should resolve Accept-Language with q-factor weighting', () => {
    // English has higher q-factor than Indonesian
    const header1 = 'en-US;q=0.9,id-ID;q=0.8';
    expect(resolveLocale(header1)).toBe('en-US');

    // Indonesian has higher q-factor
    const header2 = 'en;q=0.7,id;q=0.95';
    expect(resolveLocale(header2)).toBe('id-ID');

    // Complex list with unsupported languages first
    const header3 = 'fr-FR,de;q=0.9,en-US;q=0.8,id-ID;q=0.7';
    expect(resolveLocale(header3)).toBe('en-US');
  });

  it('should fallback to DEFAULT_LOCALE for missing or invalid header', () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('ru-RU,es-ES;q=0.9')).toBe(DEFAULT_LOCALE);
  });
});

describe('I18n Service Translation & Interpolation', () => {
  it('should translate system messages to Indonesian by default', () => {
    const msg = I18nService.translate('DESTINATION_RETRIEVED', 'id-ID');
    expect(msg).toBe('Detail destinasi berhasil diambil');
  });

  it('should translate system messages to English', () => {
    const msg = I18nService.translate('DESTINATION_RETRIEVED', 'en-US');
    expect(msg).toBe('Destination retrieved successfully');
  });

  it('should interpolate parameterized placeholders', () => {
    const idMsg = I18nService.translate('REQUIRED_FIELD', 'id-ID', { field: 'email' });
    expect(idMsg).toBe('Field email wajib diisi');

    const enMsg = I18nService.translate('REQUIRED_FIELD', 'en-US', { field: 'email' });
    expect(enMsg).toBe('Field email is required');

    const minMsg = I18nService.translate('MIN_LENGTH', 'en-US', { field: 'password', min: 8 });
    expect(minMsg).toBe('password must be at least 8 characters');
  });

  it('should fallback to default locale if key is missing in target locale', () => {
    // If key not in en-US, should return id-ID version or key
    const msg = I18nService.translate('NON_EXISTENT_KEY', 'en-US');
    expect(msg).toBe('NON_EXISTENT_KEY');
  });
});
