import { TranslationDictionary } from '../../types';

export const commonId: TranslationDictionary = {
  // Generic success
  OPERATION_SUCCESS: 'Operasi berhasil dilakukan',
  DATA_RETRIEVED: 'Data berhasil diambil',
  RESOURCE_CREATED: 'Data berhasil dibuat',
  RESOURCE_UPDATED: 'Data berhasil diperbarui',
  RESOURCE_DELETED: 'Data berhasil dihapus',

  // Generic errors
  INTERNAL_SERVER_ERROR: 'Terjadi kesalahan internal pada server',
  NOT_FOUND: 'Data yang diminta tidak ditemukan',
  BAD_REQUEST: 'Permintaan tidak valid',
  UNAUTHORIZED: 'Autentikasi diperlukan untuk mengakses resource ini',
  FORBIDDEN: 'Anda tidak memiliki izin untuk melakukan tindakan ini',
  CONFLICT: 'Terjadi konflik pada data yang dikirimkan',
  TOO_MANY_REQUESTS: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  ROUTE_NOT_FOUND: 'Rute {path} tidak ditemukan',
  INVALID_ID: 'Format ID tidak valid',
};
