/**
 * src/api/notifications/route.ts
 *
 * Real notifications collection endpoint.
 *
 * GET   /api/notifications               — List notifications for session user (or count)
 * PATCH /api/notifications               — Mark single notification or all as read
 * POST  /api/notifications               — Create a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { timeAgo } from '@/lib/timeAgo';
import redisCache from '@/lib/redis';

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
    const targetUserId = sessionUserId || requestedUserId;

    // When signed out, return immediately without touching the database
    if (!targetUserId) {
      if (countOnly) {
        return NextResponse.json({ success: true, data: { count: 0 } });
      }
      return NextResponse.json({ success: true, data: { items: [], unreadCount: 0, totalCount: 0 } });
    }

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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formatted = await Promise.all(items.map(async (n: any) => {
            let projectId = n.projectId || null;
            let requestStatus: 'pending' | 'approved' | 'rejected' | null = null;
            const isJoinReq = n.type === 'join_request' || (n.title && n.title.toLowerCase().includes('join request'));
            if (isJoinReq || n.type === 'request_approved' || n.type === 'request_rejected') {
              if (n.taskId && !n.taskId.startsWith('t')) {
                projectId = n.taskId;
              } else if (!projectId) {
                const match = n.body?.match(/"([^"]+)"/);
                if (match && match[1]) {
                  try {
                    const foundProj = await prisma.project.findFirst({
                      where: { name: match[1] },
                      select: { id: true },
                    });
                    if (foundProj) projectId = foundProj.id;
                  } catch {}
                }
              }

              if (projectId) {
                try {
                  const applicantMatch = n.body?.match(/^(.+?)\s+has requested to join/i);
                  const applicantName = applicantMatch ? applicantMatch[1].trim() : null;

                  const matchingReq = await prisma.projectJoinRequest.findFirst({
                    where: {
                      projectId,
                      ...(applicantName
                        ? { user: { name: { contains: applicantName, mode: 'insensitive' } } }
                        : {}),
                    },
                    select: { status: true },
                    orderBy: { updatedAt: 'desc' },
                  });

                  if (matchingReq) {
                    requestStatus = matchingReq.status as 'pending' | 'approved' | 'rejected';
                  }
                } catch {}
              }
            }

            const isJoinRelated = isJoinReq || n.type === 'request_approved' || n.type === 'request_rejected';
            const isApproved = isJoinRelated && (n.type === 'request_approved' || requestStatus === 'approved');
            const isRejected = isJoinRelated && (n.type === 'request_rejected' || requestStatus === 'rejected');

            return {
              ...n,
              type: isApproved ? 'request_approved' : isRejected ? 'request_rejected' : n.type,
              title: isApproved && (n.title === 'New Project Join Request' || n.title.toLowerCase().includes('join request'))
                ? 'Project Request Approved'
                : n.title,
              requestStatus: isJoinRelated ? (isApproved ? 'approved' : isRejected ? 'rejected' : 'pending') : undefined,
              projectId,
              timeAgo: timeAgo(n.createdAt),
            };
          }));

          return {
            type: 'list',
            data: formatted,
            meta: { unreadCount, totalCount },
          };
        } catch (dbErr) {
          console.warn('[GET /api/notifications] DB query warning:', dbErr);
        }
      }

      // Empty response when zero items or DB unavailable
      if (countOnly) {
        return {
          type: 'count',
          data: { count: 0 },
        };
      }

      return {
        type: 'list',
        data: [],
        meta: {
          unreadCount: 0,
          totalCount: 0,
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

    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const targetUserId = sessionUserId;

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

export async function POST(request: NextRequest) {
  try {
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const body = await request.json();
    const targetUserId = body.userId || sessionUserId;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Target user ID is required' } },
        { status: 400 }
      );
    }

    const notifModel = getNotificationDelegate();
    let createdRecord = null;

    if (notifModel) {
      try {
        createdRecord = await notifModel.create({
          data: {
            userId: targetUserId,
            title: body.title || 'Notification',
            body: body.body || '',
            type: body.type || 'system',
            read: false,
          },
        });
      } catch (dbErr) {
        console.warn('[POST /api/notifications] DB save warning:', dbErr);
      }
    }

    await redisCache.delPattern('notifs:*');

    return NextResponse.json({ success: true, data: createdRecord }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notifications] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create notification' } },
      { status: 500 }
    );
  }
}
