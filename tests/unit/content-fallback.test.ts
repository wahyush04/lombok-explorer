import { describe, it, expect } from 'vitest';
import { resolveLocalizedFields } from '../../src/i18n/content-fallback.util';

describe('Content Localization & Fallback Utility', () => {
  const entity = {
    id: 'dest-1',
    name: 'Pantai Kuta Lombok (Canonical)',
    description: 'Deskripsi kanonikal pantai kuta lombok.',
    shortDescription: 'Deskripsi singkat kanonikal.',
    address: 'Kuta, Pujut, Lombok Tengah',
    translations: [
      {
        locale: 'id-ID',
        name: 'Pantai Kuta Lombok (ID)',
        description: 'Deskripsi lengkap bahasa Indonesia.',
        shortDescription: 'Deskripsi singkat ID.',
        address: 'Kuta, Lombok Tengah (ID)',
      },
      {
        locale: 'en-US',
        name: 'Kuta Beach Lombok (EN)',
        description: 'Comprehensive English description of Kuta beach.',
        shortDescription: null, // intentionally null to test field-level fallback
        address: null,
      },
    ],
  };

  it('should return English translation fields when en-US is requested and fields are present', () => {
    const localized = resolveLocalizedFields(
      'en-US',
      entity.translations,
      entity,
      ['name', 'description'],
    );

    expect(localized.name).toBe('Kuta Beach Lombok (EN)');
    expect(localized.description).toBe('Comprehensive English description of Kuta beach.');
  });

  it('should fallback to id-ID when a field is missing/null in requested locale', () => {
    const localized = resolveLocalizedFields(
      'en-US',
      entity.translations,
      entity,
      ['name', 'shortDescription', 'address'],
    );

    // name is present in en-US
    expect(localized.name).toBe('Kuta Beach Lombok (EN)');
    // shortDescription is null in en-US, should fallback to id-ID
    expect(localized.shortDescription).toBe('Deskripsi singkat ID.');
    // address is null in en-US, should fallback to id-ID
    expect(localized.address).toBe('Kuta, Lombok Tengah (ID)');
  });

  it('should fallback to parent canonical field if both requested locale and id-ID are missing the field', () => {
    const entityMissingId = {
      id: 'dest-2',
      name: 'Air Terjun Sendang Gile (Canonical)',
      description: 'Deskripsi air terjun kanonikal.',
      translations: [
        {
          locale: 'en-US',
          name: '', // empty
          description: null,
        },
        {
          locale: 'id-ID',
          name: null,
          description: null,
        },
      ],
    };

    const localized = resolveLocalizedFields(
      'en-US',
      entityMissingId.translations as any,
      entityMissingId,
      ['name', 'description'],
    );

    expect(localized.name).toBe('Air Terjun Sendang Gile (Canonical)');
    expect(localized.description).toBe('Deskripsi air terjun kanonikal.');
  });

  it('should return id-ID translation directly when id-ID is requested', () => {
    const localized = resolveLocalizedFields(
      'id-ID',
      entity.translations,
      entity,
      ['name', 'description', 'shortDescription'],
    );

    expect(localized.name).toBe('Pantai Kuta Lombok (ID)');
    expect(localized.description).toBe('Deskripsi lengkap bahasa Indonesia.');
    expect(localized.shortDescription).toBe('Deskripsi singkat ID.');
  });

  it('should return canonical parent fields when translations array is empty or undefined', () => {
    const localizedEmpty = resolveLocalizedFields(
      'en-US',
      [],
      entity,
      ['name', 'description'],
    );

    expect(localizedEmpty.name).toBe('Pantai Kuta Lombok (Canonical)');
    expect(localizedEmpty.description).toBe('Deskripsi kanonikal pantai kuta lombok.');

    const localizedUndefined = resolveLocalizedFields(
      'en-US',
      undefined,
      entity,
      ['name', 'description'],
    );

    expect(localizedUndefined.name).toBe('Pantai Kuta Lombok (Canonical)');
  });
});
