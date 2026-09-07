import { TranslationDictionary } from '../../types';

export const validationId: TranslationDictionary = {
  VALIDATION_ERROR: 'Data yang dikirimkan tidak valid',
  REQUIRED_FIELD: 'Field {field} wajib diisi',
  INVALID_EMAIL: 'Format email tidak valid',
  INVALID_UUID: 'Format identifier {field} tidak valid',
  INVALID_TYPE: 'Tipe data untuk {field} tidak valid',
  MIN_LENGTH: '{field} harus memiliki minimal {min} karakter',
  MAX_LENGTH: '{field} tidak boleh melebihi {max} karakter',
  MIN_VALUE: '{field} minimal bernilai {min}',
  MAX_VALUE: '{field} maksimal bernilai {max}',
  INVALID_ENUM: 'Nilai {field} tidak valid',
  INVALID_URL: 'Format URL untuk {field} tidak valid',
  INVALID_COORDINATES: 'Koordinat lokasi tidak valid',
  INVALID_LOCALE: 'Kode bahasa {locale} tidak didukung',
  DUPLICATE_LOCALE: 'Kode bahasa tidak boleh duplikat',
  REQUIRED_LOCALE_MISSING: 'Terjemahan untuk bahasa default {locale} wajib diisi',
};
