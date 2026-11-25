import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recipientsWanting, wantsNotification } from '@/lib/notificationPrefs';
import { inTeam } from '@/lib/workspaces';
import { auth } from '@/auth';
import { timeAgo } from '@/lib/timeAgo';
import { requireTaskAccess } from '@/lib/access';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/comments
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    const access = await requireTaskAccess(taskId);
    if (!access.ok) return access.response;

    const dbComments = await prisma.comment.findMany({
      where: { taskId },
      select: {
        id: true,
        text: true,
        reactions: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        taskId: true,
        userId: true,
        replyToId: true,
        replyTo: {
          select: {
            id: true,
            text: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = dbComments.map(c => ({
      ...c,
      timeAgo: timeAgo(c.createdAt),
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/tasks/:id/comments] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch comments';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/comments
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    // Authenticate user
    let sessionUser: { id?: string; email?: string; name?: string; role?: string } | undefined = undefined;
    try {
      const session = await auth();
      if (session?.user) {
        sessionUser = session.user as { id?: string; email?: string; name?: string; role?: string };
      }
    } catch { }

    // Session-only identity + task access (never trust ?userId=)
    const access = await requireTaskAccess(taskId);
    if (!access.ok) return access.response;
    const authorId = access.value.user.id;

    if (!authorId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be logged in to comment' } },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const replyToId = typeof body.replyToId === 'string' && body.replyToId.trim() ? body.replyToId.trim() : undefined;

    if (!text) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Comment text cannot be empty' } },
        { status: 400 }
      );
    }

    // Verify task exists with creator, assignee and project details
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        taskNumber: true,
        assigneeId: true,
        creatorId: true,
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Task "${taskId}" not found` } },
        { status: 404 }
      );
    }

    // Create comment and increment task commentsCount in a transaction
    const [newComment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          taskId,
          userId: authorId,
          text,
          replyToId,
        },
        select: {
          id: true,
          text: true,
          reactions: true,
          isEdited: true,
          createdAt: true,
          updatedAt: true,
          taskId: true,
          userId: true,
          replyToId: true,
          replyTo: {
            select: {
              id: true,
              text: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  role: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
      }),
      prisma.task.update({
        where: { id: taskId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    // Handle mentions and reply notifications
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notifModel = (prisma as any).notification;
      if (notifModel) {
        const authorName = newComment.user?.name ?? sessionUser?.name ?? 'Someone';
        const notifiedUserIds = new Set<string>();
        notifiedUserIds.add(authorId); // Do not notify yourself

        // 1. Check for @mentions in comment text
        const mentionMatches = text.match(/@([a-zA-Z0-9_\s.-]+?)(?=\s|$|[,.!?])/g);
        if (mentionMatches && mentionMatches.length > 0) {
          // Only users in the author's own company can be mentioned (tenant isolation)
          const mentionTeamId = access.value.user.teamId;
          const allUsers = mentionTeamId
            ? await prisma.user.findMany({
                where: inTeam(mentionTeamId),
                select: { id: true, name: true, email: true },
              })
            : [];

          for (const rawMention of mentionMatches) {
            const cleanMention = rawMention.slice(1).trim().toLowerCase();
            const matchedUser = allUsers.find(
              u =>
                u.name.toLowerCase() === cleanMention ||
                u.name.toLowerCase().startsWith(cleanMention) ||
                u.email.toLowerCase().startsWith(cleanMention)
            );

            if (matchedUser && !notifiedUserIds.has(matchedUser.id)) {
              notifiedUserIds.add(matchedUser.id);
              if (!(await wantsNotification(matchedUser.id, 'mentioned'))) continue;
              await notifModel.create({
                data: {
                  userId: matchedUser.id,
                  type: 'comment_mention',
                  title: `${authorName} mentioned you in ${task.taskNumber ?? task.title}`,
                  body: text.slice(0, 120),
                  taskId: task.id,
                },
              });
            }
          }
        }

        // 2. If replying to another comment, notify the parent comment author
        if (
          newComment.replyTo?.user?.id &&
          !notifiedUserIds.has(newComment.replyTo.user.id) &&
          (await wantsNotification(newComment.replyTo.user.id, 'mentioned'))
        ) {
          notifiedUserIds.add(newComment.replyTo.user.id);
          await notifModel.create({
            data: {
              userId: newComment.replyTo.user.id,
              type: 'comment_mention',
              title: `${authorName} replied to your comment on ${task.taskNumber ?? task.title}`,
              body: text.slice(0, 120),
              taskId: task.id,
            },
          });
        }

        // 3. If the task creator is not notified yet and is not author, notify them
        const creatorTargetId = task.creatorId || task.assigneeId;
        if (creatorTargetId && !notifiedUserIds.has(creatorTargetId)) {
          notifiedUserIds.add(creatorTargetId);
          await notifModel.create({
            data: {
              userId: creatorTargetId,
              type: 'comment_mention',
              title: `New comment on ${task.taskNumber ?? task.title}`,
              body: `${authorName}: "${text.slice(0, 100)}"`,
              taskId: task.id,
            },
          });
        }
      }
    } catch (notifErr) {
      console.warn('[POST /api/tasks/:id/comments] Notification ignored:', notifErr);
    }

    const formattedComment = {
      ...newComment,
      timeAgo: 'Just now',
    };

    return NextResponse.json({ success: true, data: formattedComment }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/tasks/:id/comments] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create comment';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/comments — Edit existing comment
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    // Authenticate user
    let sessionUser: { id?: string; email?: string; role?: string } | undefined = undefined;
    try {
      const session = await auth();
      if (session?.user) {
        sessionUser = session.user as { id?: string; email?: string; role?: string };
      }
    } catch { }

    // Session-only identity + task access (never trust ?userId=)
    const access = await requireTaskAccess(taskId);
    if (!access.ok) return access.response;
    const authorId = access.value.user.id;

    if (!authorId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be logged in to edit comments' } },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const commentId = typeof body.commentId === 'string' ? body.commentId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!commentId || !text) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Comment ID and text are required' } },
        { status: 400 }
      );
    }

    // Find comment and verify ownership or elevated role (admin / project manager)
    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: { select: { id: true, role: true } },
      },
    });

    if (!existing || existing.taskId !== taskId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    const userRole = (sessionUser?.role || existing.user.role || '').toLowerCase();
    const isOwner = existing.userId === authorId;
    const isElevated = userRole === 'admin' || userRole === 'administrator' || userRole.includes('manager');

    if (!isOwner && !isElevated) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only edit your own comments' } },
        { status: 403 }
      );
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        text,
        isEdited: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        text: true,
        reactions: true,
        isEdited: true,
        createdAt: true,
        updatedAt: true,
        taskId: true,
        userId: true,
        replyToId: true,
        replyTo: {
          select: {
            id: true,
            text: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        timeAgo: timeAgo(updated.createdAt),
      },
    });
  } catch (err) {
    console.error('[PATCH /api/tasks/:id/comments] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update comment';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id/comments — Remove comment
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    let sessionUser: { id?: string; email?: string; role?: string } | undefined = undefined;
    try {
      const session = await auth();
      if (session?.user) {
        sessionUser = session.user as { id?: string; email?: string; role?: string };
      }
    } catch { }

    // Session-only identity + task access (never trust ?userId=)
    const access = await requireTaskAccess(taskId);
    if (!access.ok) return access.response;
    const authorId = access.value.user.id;

    if (!authorId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be logged in to delete comments' } },
        { status: 401 }
      );
    }

    const queryCommentId = request.nextUrl.searchParams.get('commentId');
    let bodyCommentId: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.commentId === 'string') bodyCommentId = body.commentId;
    } catch { }

    const commentId = queryCommentId || bodyCommentId;
    if (!commentId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'commentId is required' } },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!existing || existing.taskId !== taskId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    const userRole = (sessionUser?.role || existing.user.role || '').toLowerCase();
    const isOwner = existing.userId === authorId;
    const isElevated = userRole === 'admin' || userRole === 'administrator' || userRole.includes('manager');

    if (!isOwner && !isElevated) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You can only delete your own comments' } },
        { status: 403 }
      );
    }

    await prisma.comment.delete({ where: { id: commentId } });
    void prisma.task.update({
      where: { id: taskId },
      data: { commentsCount: { decrement: 1 } },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/tasks/:id/comments] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete comment';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
