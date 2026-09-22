

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { CreateCommentSchema, validationError } from '@/lib/validators';
import { timeAgo } from '@/lib/timeAgo';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/comments
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: taskId } = await context.params;

    const dbComments = await prisma.comment.findMany({
      where: { taskId },
      select: {
        id: true,
        text: true,
        reactions: true,
        createdAt: true,
        taskId: true,
        userId: true,
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
    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch { }

    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const authorId = sessionUserId || requestedUserId;

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

    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
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
          text: parsed.data.text,
        },
        select: {
          id: true,
          text: true,
          reactions: true,
          createdAt: true,
          taskId: true,
          userId: true,
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

    const formattedComment = {
      ...newComment,
      timeAgo: 'just now',
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
