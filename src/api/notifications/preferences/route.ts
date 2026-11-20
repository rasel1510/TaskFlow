/**
 * src/api/notifications/preferences/route.ts
 *
 * Notification preferences, stored per user in User.notificationPrefs (JSON).
 *   GET   /api/notifications/preferences  — the signed-in user's preferences (defaults if unset)
 *   PATCH /api/notifications/preferences  — update known keys only
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';

export interface NotificationPreferences {
  // Channels
  inApp: boolean;
  browserPush: boolean;
  emailDigest: 'instant' | 'daily' | 'off';

  // Task & Activity Triggers
  task_assigned: boolean;
  task_due_soon: boolean;
  comment_on_task: boolean;
  mentioned: boolean;
  status_changed: boolean;
  new_member: boolean;

  // Role-Specific Triggers
  pm_project_at_risk: boolean;
  pm_sprint_milestones: boolean;
  admin_security_alerts: boolean;
  admin_system_metrics: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  inApp: true,
  browserPush: false,
  emailDigest: 'daily',

  task_assigned: true,
  task_due_soon: true,
  comment_on_task: true,
  mentioned: true,
  status_changed: true,
  new_member: false,

  pm_project_at_risk: true,
  pm_sprint_milestones: true,
  admin_security_alerts: true,
  admin_system_metrics: false,
};

const DIGEST_VALUES = new Set(['instant', 'daily', 'off']);

/** Keep only known keys with the right types (ignores anything else a client sends). */
function sanitize(input: unknown): Partial<NotificationPreferences> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(DEFAULT_PREFERENCES)) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (key === 'emailDigest') {
      if (typeof value === 'string' && DIGEST_VALUES.has(value)) out[key] = value;
    } else if (typeof def === 'boolean' && typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out as Partial<NotificationPreferences>;
}

async function loadPrefs(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  return { ...DEFAULT_PREFERENCES, ...sanitize(user?.notificationPrefs) };
}

export async function GET() {
  try {
    const userRes = await requireUser();
    if (!userRes.ok) return userRes.response;
    return NextResponse.json({ success: true, data: await loadPrefs(userRes.value.id) });
  } catch (err) {
    console.error('[GET /api/notifications/preferences] Error:', err);
    return NextResponse.json({ success: false, error: { message: 'Failed to fetch preferences' } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userRes = await requireUser();
    if (!userRes.ok) return userRes.response;
    const userId = userRes.value.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: { message: 'Invalid JSON payload' } }, { status: 400 });
    }

    const updated: NotificationPreferences = { ...(await loadPrefs(userId)), ...sanitize(body) };
    await prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: updated as unknown as object },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PATCH /api/notifications/preferences] Error:', err);
    return NextResponse.json({ success: false, error: { message: 'Failed to update preferences' } }, { status: 500 });
  }
}
