/**
 * src/api/notifications/preferences/route.ts
 *
 * Notification preferences persistence endpoint:
 *   GET   /api/notifications/preferences  — Fetch user notification preferences
 *   PATCH /api/notifications/preferences  — Update notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

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
  subtask_completed: boolean;
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
  subtask_completed: true,
  new_member: false,

  pm_project_at_risk: true,
  pm_sprint_milestones: true,
  admin_security_alerts: true,
  admin_system_metrics: false,
};

// Global in-memory storage keyed by user ID
const userPreferencesStore = new Map<string, NotificationPreferences>();

export async function GET(_request: NextRequest) {
  try {
    let userId = 'u1';
    try {
      const session = await auth();
      if (session?.user?.id) userId = session.user.id;
    } catch {}

    const prefs = userPreferencesStore.get(userId) || DEFAULT_PREFERENCES;
    return NextResponse.json({ success: true, data: prefs }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/notifications/preferences] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch preferences' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let userId = 'u1';
    try {
      const session = await auth();
      if (session?.user?.id) userId = session.user.id;
    } catch {}

    const body = await request.json();
    const current = userPreferencesStore.get(userId) || DEFAULT_PREFERENCES;
    const updated: NotificationPreferences = {
      ...current,
      ...body,
    };

    userPreferencesStore.set(userId, updated);
    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error('[PATCH /api/notifications/preferences] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to update preferences' } },
      { status: 500 }
    );
  }
}
