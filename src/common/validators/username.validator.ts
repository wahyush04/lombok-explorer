import { z } from 'zod';

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'superadmin',
  'system',
  'support',
  'official',
  'root',
  'superuser',
  'moderator',
  'mod',
  'help',
  'api',
  'auth',
  'null',
  'undefined',
  'guest',
  'lombokexplorer',
  'lombok_explorer',
  'feeds',
  'feed',
  'user',
  'users',
  'post',
  'posts',
  'explore',
  'explorer',
  'security',
  'test',
  'testing',
  'dev',
  'development',
]);

export function isReservedUsername(val: string): boolean {
  return RESERVED_USERNAMES.has(val.toLowerCase().trim());
}

export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export const basicUsernameFormatSchema = z
  .string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
  })
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must not exceed 30 characters')
  .transform((val) => val.toLowerCase())
  .refine((val) => USERNAME_REGEX.test(val), {
    message: 'Username can only contain lowercase letters, numbers, and underscores',
  })
  .refine((val) => !val.startsWith('_') && !val.endsWith('_'), {
    message: 'Username cannot start or end with an underscore',
  })
  .refine((val) => !val.includes('__'), {
    message: 'Username cannot contain consecutive underscores',
  });

export const usernameSchema = basicUsernameFormatSchema.refine((val) => !RESERVED_USERNAMES.has(val), {
  message: 'This username is reserved and cannot be used',
});
