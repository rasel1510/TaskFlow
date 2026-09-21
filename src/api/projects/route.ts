/**
 * src/api/projects/route.ts
 *
 * Projects collection endpoint — core API handler.
 *
 * Endpoints (re-exported via src/app/api/projects/route.ts):
 *   GET  /api/projects   — List all projects
 *   POST /api/projects   — Create a new project
 *
 * Architecture note:
 *   Business logic lives here. The Next.js App Router bridge at
 *   src/app/api/projects/route.ts simply re-exports these handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projects as mockProjects } from '@/data/mockData';

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const dbProjects = await prisma.project.findMany({
      include: {
        owner: true,
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const projects = dbProjects.length > 0 ? dbProjects : mockProjects;
    return NextResponse.json(projects, { status: 200 });
  } catch {
    // Graceful fallback when the database is unavailable (offline dev mode)
    return NextResponse.json(mockProjects, { status: 200 });
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
        { message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const { name, description, ownerId, color, startDate, dueDate } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { message: 'Project name is required' },
        { status: 400 }
      );
    }
    if (!ownerId || typeof ownerId !== 'string') {
      return NextResponse.json(
        { message: 'ownerId is required' },
        { status: 400 }
      );
    }

    const newProject = await prisma.project.create({
      data: {
        name: (name as string).trim(),
        description: (description as string | undefined) ?? '',
        ownerId: ownerId as string,
        color: (color as string | undefined) ?? '#2563EB',
        startDate: startDate ? new Date(startDate as string) : undefined,
        dueDate:   dueDate   ? new Date(dueDate   as string) : undefined,
      },
      include: { owner: true, tasks: true },
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error while creating project' },
      { status: 500 }
    );
  }
}
