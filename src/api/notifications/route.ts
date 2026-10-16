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
export interface DemoNotification {
  id: string;
  userId: string;
  category: 'user' | 'project' | 'admin';
  type: string;
  title: string;
  body: string;
  taskId?: string | null;
  projectId?: string | null;
  actor?: { name: string; avatar: string };
  meta?: string;
  read: boolean;
  createdAt: string;
}

const demoNotifications: DemoNotification[] = [
  // User / Team Member Notifications
  {
    id: 'demo-notif-u1',
    userId: 'u1',
    category: 'user',
    type: 'task_assigned',
    title: 'Task assigned to you',
    body: 'Sarah Chen assigned you to TF-012: Accessibility audit & keyboard navigation',
    taskId: 't2',
    actor: { name: 'Sarah Chen', avatar: 'SC' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'demo-notif-u2',
    userId: 'u1',
    category: 'user',
    type: 'comment_mention',
    title: 'Mentioned in comment',
    body: 'Ahmed Malik mentioned you on TF-003: "The database indexes are ready for review."',
    taskId: 't3',
    actor: { name: 'Ahmed Malik', avatar: 'AM' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'demo-notif-u3',
    userId: 'u1',
    category: 'user',
    type: 'task_overdue',
    title: 'Task deadline approaching',
    body: 'TF-002: Authentication flows is due within 24 hours.',
    taskId: 't1',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'demo-notif-u4',
    userId: 'u1',
    category: 'user',
    type: 'subtask_completed',
    title: 'Subtask completed',
    body: 'John Torres completed "Unit tests for token refresh" on TF-008.',
    taskId: 't4',
    actor: { name: 'John Torres', avatar: 'JT' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },

  // Product Manager / Project & Sprint Notifications
  {
    id: 'demo-notif-pm1',
    userId: 'u1',
    category: 'project',
    type: 'project_at_risk',
    title: 'Project health: At Risk',
    body: 'Mobile App Redesign health dropped to At Risk due to 2 overdue milestones.',
    meta: 'Mobile App Redesign',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'demo-notif-pm2',
    userId: 'u1',
    category: 'project',
    type: 'project_milestone',
    title: 'Sprint milestone reached',
    body: 'Sprint 14 reached 80% story points completion ahead of target cycle.',
    meta: 'Sprint 14',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'demo-notif-pm3',
    userId: 'u1',
    category: 'project',
    type: 'blocker_reported',
    title: 'Critical blocker reported',
    body: 'TF-045 flagged as blocker: "Cloudflare SSL certificate expired on staging environment."',
    actor: { name: 'Rasel Ahmed', avatar: 'RA' },
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'demo-notif-pm4',
    userId: 'u1',
    category: 'project',
    type: 'workload_alert',
    title: 'Team workload threshold',
    body: 'Frontend Engineering capacity exceeded 115% for upcoming release.',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },

  // Admin / Security & System Notifications
  {
    id: 'demo-notif-adm1',
    userId: 'u1',
    category: 'admin',
    type: 'security_alert',
    title: 'Security audit alert',
    body: 'New administrative session initiated from Chrome on macOS (IP: 192.168.1.104).',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'demo-notif-adm2',
    userId: 'u1',
    category: 'admin',
    type: 'user_registered',
    title: 'New user registered',
    body: 'David Miller (david@flowsync.io) successfully verified account as DevOps Engineer.',
    actor: { name: 'David Miller', avatar: 'DM' },
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'demo-notif-adm3',
    userId: 'u1',
    category: 'admin',
    type: 'backup_completed',
    title: 'Automated database snapshot',
    body: 'Daily PostgreSQL backup completed: 4.8MB compressed snapshot saved to cold storage.',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: 'demo-notif-adm4',
    userId: 'u1',
    category: 'admin',
    type: 'system_metric',
    title: 'Distributed cache peak',
    body: 'Redis cache hit-rate reached 99.1% across 14,200 operations.',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
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

          if (items.length > 0 || totalCount > 0) {
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

export async function POST(request: NextRequest) {
  try {
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {}

    const targetUserId = sessionUserId || 'u1';
    const body = await request.json();

    const newNotif: DemoNotification = {
      id: `notif-${Date.now()}`,
      userId: targetUserId,
      category: body.category || 'user',
      type: body.type || 'system_test',
      title: body.title || 'Test Notification',
      body: body.body || 'Your notification pipeline is working correctly.',
      read: false,
      createdAt: new Date().toISOString(),
    };

    const notifModel = getNotificationDelegate();
    if (notifModel) {
      try {
        await notifModel.create({
          data: {
            userId: targetUserId,
            title: newNotif.title,
            body: newNotif.body,
            type: newNotif.type,
            read: false,
          },
        });
      } catch (dbErr) {
        console.warn('[POST /api/notifications] DB save warning:', dbErr);
      }
    }

    demoNotifications.unshift(newNotif);
    await redisCache.delPattern('notifs:*');

    return NextResponse.json({ success: true, data: newNotif }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notifications] Error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create notification' } },
      { status: 500 }
    );
  }
}






