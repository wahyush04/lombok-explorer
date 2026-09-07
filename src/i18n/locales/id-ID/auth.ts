import { TranslationDictionary } from '../../types';

export const authId: TranslationDictionary = {
  LOGIN_SUCCESS: 'Login berhasil',
  REGISTER_SUCCESS: 'Pendaftaran berhasil',
  LOGOUT_SUCCESS: 'Logout berhasil',
  TOKEN_REFRESH_SUCCESS: 'Token berhasil diperbarui',
  INVALID_CREDENTIALS: 'Email atau kata sandi tidak valid',
  EMAIL_ALREADY_EXISTS: 'Email sudah terdaftar',
  USERNAME_ALREADY_EXISTS: 'Username sudah digunakan',
  INVALID_TOKEN: 'Token autentikasi tidak valid atau telah kedaluwarsa',
  REFRESH_TOKEN_EXPIRED: 'Sesi telah kedaluwarsa, silakan masuk kembali',
  UNAUTHORIZED_ACCESS: 'Akses tidak diizinkan',
  FORBIDDEN_ROLE: 'Anda tidak memiliki hak akses untuk tindakan ini',
  PASSWORD_RESET_SUCCESS: 'Kata sandi berhasil direset',
  PASSWORD_RESET_REQUESTED: 'Instruksi reset kata sandi telah dikirim ke email Anda',
};
