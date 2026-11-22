/**
 * src/lib/notificationPrefs.ts
 *
 * Per-user notification switches (stored in User.notificationPrefs as JSON).
 * Only notifications FlowSync actually sends have a switch:
 *
 *   task_assigned     — a task is assigned to you (on create or reassign)
 *   mentioned         — someone @mentions you in a comment, or replies to your comment
 *   project_activity  — you're added to a project, your join request is answered,
 *                       or someone replies to your project invitation
 *
 * Requests to join a project you manage are always delivered (they need a reply).
 * Older stored keys (due-soon, status changes, digests, …) are ignored.
 */

import prisma from '@/lib/prisma';

export type NotificationPrefKey = 'task_assigned' | 'mentioned' | 'project_activity';
export type NotificationPreferences = Record<NotificationPrefKey, boolean>;

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  task_assigned: true,
  mentioned: true,
  project_activity: true,
};

/** Keep only known keys with boolean values (ignores anything else, including legacy keys). */
export function sanitizePreferences(input: unknown): Partial<NotificationPreferences> {
  if (!input || typeof input !== 'object') return {};
  const out: Partial<NotificationPreferences> = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES) as NotificationPrefKey[]) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function resolvePreferences(stored: unknown): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, ...sanitizePreferences(stored) };
}

/**
 * Of `userIds`, the ones who want notifications of `key`. One query for any number of users;
 * on a database error it fails open (everyone is notified) rather than silently dropping alerts.
 */
export async function recipientsWanting(userIds: string[], key: NotificationPrefKey): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];
  try {
    const rows = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, notificationPrefs: true },
    });
    const allowed = new Set(rows.filter(r => resolvePreferences(r.notificationPrefs)[key]).map(r => r.id));
    return unique.filter(id => allowed.has(id));
  } catch (err) {
    console.warn('[notificationPrefs] Could not read preferences, notifying anyway:', err);
    return unique;
  }
}

/** Single-user convenience for `recipientsWanting`. */
export async function wantsNotification(userId: string, key: NotificationPrefKey): Promise<boolean> {
  return (await recipientsWanting([userId], key)).length > 0;
}
