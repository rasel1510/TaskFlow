/**
 * src/api/search/route.ts
 *
 * Global search endpoint for Command Palette (Ctrl+K / Cmd+K).
 *
 * Queries:
 *   GET /api/search?q=<term>&limit=10
 *
 * Searches tasks (by title, taskNumber) and projects (by name, description).
 * Returns grouped results in a unified ApiResponse envelope:
 *   { success: true, data: { tasks: [...], projects: [...] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 25);

    if (!q) {
      return NextResponse.json(
        { success: true, data: { tasks: [], projects: [] } },
        { status: 200 }
      );
    }

    let sessionUserId: string | undefined = undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
    } catch {
      // In case session extraction fails
    }

    try {
      // Search in Postgres via Prisma with low time-complexity indexed queries
      const [dbTasks, dbProjects] = await Promise.all([
        prisma.task.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { taskNumber: { contains: q, mode: 'insensitive' } },
            ],
            ...(sessionUserId ? { assigneeId: sessionUserId } : {}),
          },
          take: limit,
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.project.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: Math.min(limit, 5),
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            health: true,
            progress: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          data: {
            tasks: dbTasks,
            projects: dbProjects,
          },
        },
        { status: 200 }
      );
    } catch (dbErr) {
      console.warn('[GET /api/search] DB error:', dbErr);
      return NextResponse.json(
        {
          success: true,
          data: {
            tasks: [],
            projects: [],
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[GET /api/search] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to execute search' },
      },
      { status: 500 }
    );
  }
}
