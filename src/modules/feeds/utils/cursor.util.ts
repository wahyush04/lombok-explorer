import { CursorPayload } from '../feeds.types';

/**
 * Encodes an item's timestamp and ID into a deterministic, URL-safe base64 cursor.
 */
export function encodeCursor(item: { createdAt: Date | string; id: string }): string {
  const dateStr = item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt;
  const payload: CursorPayload = {
    createdAt: dateStr,
    id: item.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decodes a base64url cursor string into its timestamp and ID payload.
 * Returns null if the cursor is malformed or invalid.
 */
export function decodeCursor(cursorStr?: string | null): CursorPayload | null {
  if (!cursorStr || typeof cursorStr !== 'string' || cursorStr.trim() === '') {
    return null;
  }

  try {
    const json = Buffer.from(cursorStr.trim(), 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.createdAt === 'string' &&
      typeof parsed.id === 'string' &&
      !isNaN(Date.parse(parsed.createdAt)) &&
      parsed.id.trim().length > 0
    ) {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
