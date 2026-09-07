import { TranslationDictionary } from '../../types';

export const notificationEn: TranslationDictionary = {
  NOTIFICATIONS_RETRIEVED: 'Notifications retrieved successfully',
  NOTIFICATION_MARKED_READ: 'Notification marked as read successfully',
  ALL_NOTIFICATIONS_MARKED_READ: 'All notifications marked as read successfully',
  UNREAD_COUNT_RETRIEVED: 'Unread notification count retrieved successfully',
  DEVICE_TOKEN_REGISTERED: 'Device token registered successfully',
  DEVICE_TOKEN_REMOVED: 'Device token removed successfully',

  // Push notification copy templates
  PUSH_POST_LIKED_TITLE: 'New Like',
  PUSH_POST_LIKED_BODY: '{actorName} liked your post: "{postTitle}"',
  PUSH_POST_COMMENTED_TITLE: 'New Comment',
  PUSH_POST_COMMENTED_BODY: '{actorName} commented on your post: "{postTitle}"',
};
