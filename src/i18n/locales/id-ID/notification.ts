import { TranslationDictionary } from '../../types';

export const notificationId: TranslationDictionary = {
  NOTIFICATIONS_RETRIEVED: 'Daftar notifikasi berhasil diambil',
  NOTIFICATION_MARKED_READ: 'Notifikasi berhasil ditandai sudah dibaca',
  ALL_NOTIFICATIONS_MARKED_READ: 'Semua notifikasi berhasil ditandai sudah dibaca',
  UNREAD_COUNT_RETRIEVED: 'Jumlah notifikasi belum dibaca berhasil diambil',
  DEVICE_TOKEN_REGISTERED: 'Token perangkat berhasil didaftarkan',
  DEVICE_TOKEN_REMOVED: 'Token perangkat berhasil dihapus',

  // Push notification copy templates
  PUSH_POST_LIKED_TITLE: 'Suka Baru',
  PUSH_POST_LIKED_BODY: '{actorName} menyukai postingan Anda: "{postTitle}"',
  PUSH_POST_COMMENTED_TITLE: 'Komentar Baru',
  PUSH_POST_COMMENTED_BODY: '{actorName} mengomentari postingan Anda: "{postTitle}"',
};
