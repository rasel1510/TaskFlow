/**
 * src/api/notifications/route.ts
 *
 * Real notifications collection endpoint.
 *
 * GET   /api/notifications               — List notifications for session user (or count)
 * PATCH /api/notifications               — Mark single notification or all as read
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { timeAgo } from '@/lib/timeAgo';
import { currentUser } from '@/data/mockData';
import redisCache from '@/lib/redis';

// Fallback in-memory demo notifications when DB has zero notifications
const demoNotifications = [
  {
    id: 'demo-notif-1',
    userId: 'u1',
    type: 'task_assigned',
    title: 'Assigned to new task',
    body: 'Sarah Chen assigned you to TF-012: Accessibility audit & keyboard navigation',
    taskId: 't2',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'demo-notif-2',
    userId: 'u1',
    type: 'comment_mention',
    title: 'New comment on TF-003',
    body: 'Ahmed Malik mentioned: "The API schemas are now fully validated with Zod."',
    taskId: 't3',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'demo-notif-3',
    userId: 'u1',
    type: 'task_overdue',
    title: 'Task due soon',
    body: 'TF-002: Authentication flows is due within 24 hours.',
    taskId: 't1',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

// Helper to access notification delegate safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNotificationDelegate(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any).notification;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const countOnly = searchParams.get('countOnly') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);

    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch { }

    const requestedUserId = searchParams.get('userId');
    const targetUserId = sessionUserId || requestedUserId || currentUser.id;

    const cacheKey = `notifs:${targetUserId}:${unreadOnly}:${countOnly}:${limit}`;

    const cachedData = await redisCache.wrap(cacheKey, 15, async () => {
      const notifModel = getNotificationDelegate();

      if (notifModel) {
        try {
          if (countOnly) {
            const count = await notifModel.count({
              where: {
                userId: targetUserId,
                ...(unreadOnly ? { read: false } : {}),
              },
            });
            return { type: 'count', data: { count } };
          }

          const [items, unreadCount, totalCount] = await Promise.all([
            notifModel.findMany({
              where: {
                userId: targetUserId,
                ...(unreadOnly ? { read: false } : {}),
              },
              take: limit,
              orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
            }),
            notifModel.count({
              where: {
                userId: targetUserId,
                read: false,
              },
            }),
            notifModel.count({
              where: {
                userId: targetUserId,
              },
            }),
          ]);

          if (items.length > 0 || totalCount > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formatted = items.map((n: any) => ({
              ...n,
              timeAgo: timeAgo(n.createdAt),
            }));

            return {
              type: 'list',
              data: formatted,
              meta: { unreadCount, totalCount },
            };
          }
        } catch (dbErr) {
          console.warn('[GET /api/notifications] DB query warning:', dbErr);
        }
      }

      // Fallback mode: return demo notifications
      const filteredDemo = demoNotifications.filter(n => (unreadOnly ? !n.read : true));
      if (countOnly) {
        return {
          type: 'count',
          data: { count: demoNotifications.filter(n => !n.read).length },
        };
      }

      const formattedDemo = filteredDemo.map(n => ({
        ...n,
        timeAgo: timeAgo(n.createdAt),
      }));

      return {
        type: 'list',
        data: formattedDemo,
        meta: {
          unreadCount: demoNotifications.filter(n => !n.read).length,
          totalCount: demoNotifications.length,
        },
      };
    });

    if (cachedData.type === 'count') {
      return NextResponse.json({ success: true, data: cachedData.data }, { status: 200 });
    }

    return NextResponse.json(
      {
        success: true,
        data: cachedData.data,
        meta: cachedData.meta,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[GET /api/notifications] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch { }

    const targetUserId = sessionUserId || currentUser.id;

    let body: { id?: string; read?: boolean; all?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const notifModel = getNotificationDelegate();

    if (body.all) {
      if (notifModel) {
        try {
          await notifModel.updateMany({
            where: { userId: targetUserId, read: false },
            data: { read: true },
          });
        } catch { }
      }
      demoNotifications.forEach(n => {
        n.read = true;
      });
      await redisCache.delPattern('notifs:*');
      return NextResponse.json({ success: true, message: 'All notifications marked as read' }, { status: 200 });
    }

    if (body.id) {
      const readVal = body.read ?? true;
      if (notifModel) {
        try {
          await notifModel.update({
            where: { id: body.id },
            data: { read: readVal },
          });
        } catch { }
      }
      const match = demoNotifications.find(n => n.id === body.id);
      if (match) match.read = readVal;

      await redisCache.delPattern('notifs:*');
      return NextResponse.json({ success: true, message: 'Notification updated' }, { status: 200 });
    }

    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing "id" or "all" in request payload' } },
      { status: 400 }
    );
  } catch (err) {
    console.error('[PATCH /api/notifications] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update notifications' } },
      { status: 500 }
    );
  }
}





