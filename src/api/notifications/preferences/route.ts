/**
 * src/api/notifications/preferences/route.ts
 *
 * Notification preferences, stored per user in User.notificationPrefs (JSON).
 * The switches and their meaning live in src/lib/notificationPrefs.ts.
 *   GET   /api/notifications/preferences  — the signed-in user's preferences (defaults if unset)
 *   PATCH /api/notifications/preferences  — update known keys only
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';
import {
  resolvePreferences,
  sanitizePreferences,
  type NotificationPreferences,
} from '@/lib/notificationPrefs';

async function loadPrefs(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  return resolvePreferences(user?.notificationPrefs);
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

    const updated: NotificationPreferences = { ...(await loadPrefs(userId)), ...sanitizePreferences(body) };
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
