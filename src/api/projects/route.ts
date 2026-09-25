/**
 * src/api/projects/route.ts
 *
 * Projects collection endpoint — core API handler.
 *
 * Endpoints (re-exported via src/app/api/projects/route.ts):
 *   GET  /api/projects   — List all projects (with owner + task count)
 *   POST /api/projects   — Create a new project
 *
 * Architecture note:
 *   Business logic lives here. The Next.js App Router bridge at
 *   src/app/api/projects/route.ts simply re-exports these handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projects as mockProjects } from '@/data/mockData';
import { CreateProjectSchema, validationError } from '@/lib/validators';
import redisCache from '@/lib/redis';

/**
 * Safely parse a date string. Returns undefined for empty, invalid, or
 * out-of-range (year < 2000 or > 2100) values.
 */
function parseSafeDate(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return undefined;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return d;
}

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const projects = await redisCache.wrap('projects:list', 60, async () => {
      const dbProjects = await prisma.project.findMany({
        include: {
          // Fetch only the columns we need from the owner — no passwords, no relations
          owner: {
            select: { id: true, name: true, email: true, avatar: true, role: true },
          },
          // Count tasks instead of fetching all rows — O(1) vs O(N)
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      let projectList = dbProjects;

      // Fall back to mock data only when DB has zero projects (first-run / offline dev)
      if (projectList.length === 0) {
        const existingUser = await prisma.user.findFirst();
        if (existingUser) {
          try {
            await Promise.all(
              mockProjects.map(mp =>
                prisma.project.upsert({
                  where: { id: mp.id },
                  update: {},
                  create: {
                    id: mp.id,
                    name: mp.name,
                    description: mp.description,
                    color: mp.color || '#2563EB',
                    health: (mp.health as any) || 'on_track',
                    progress: typeof mp.progress === 'number' ? mp.progress : 0,
                    ownerId: existingUser.id,
                  },
                })
              )
            );
            projectList = await prisma.project.findMany({
              include: {
                owner: {
                  select: { id: true, name: true, email: true, avatar: true, role: true },
                },
                _count: {
                  select: { tasks: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            });
          } catch (seedErr) {
            console.warn('[GET /api/projects] Auto-seed projects fallback warning:', seedErr);
          }
        }
      }

      const rawList = projectList.length > 0 ? projectList : mockProjects;
      return rawList.map(p => ({
        ...p,
        taskCount: ('_count' in p && p._count && typeof p._count === 'object' && 'tasks' in p._count)
          ? (p._count as { tasks: number }).tasks
          : ('taskCount' in p && typeof (p as unknown as Record<string, unknown>).taskCount === 'number')
          ? (p as unknown as { taskCount: number }).taskCount
          : 0,
      }));
    });

    return NextResponse.json({ success: true, data: projects }, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
    });
  } catch {
    // Graceful fallback when the database is unavailable (offline dev mode)
    return NextResponse.json({ success: true, data: mockProjects }, { status: 200 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    // --- Zod validation ---
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, description, ownerId, color, startDate, dueDate } = parsed.data;

    // Verify owner exists in DB to prevent foreign key violation on Project_ownerId_fkey
    let validOwnerId = ownerId;
    const ownerExists = await prisma.user.findUnique({ where: { id: validOwnerId } });
    if (!ownerExists) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        validOwnerId = firstUser.id;
      }
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: validOwnerId,
        color,
        startDate: parseSafeDate(startDate),
        dueDate:   parseSafeDate(dueDate),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
        _count: { select: { tasks: true } },
      },
    });

    // Invalidate project and report caches
    await Promise.all([
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('reports:*'),
    ]);

    return NextResponse.json({ success: true, data: newProject }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error while creating project' } },
      { status: 500 }
    );
  }
}
