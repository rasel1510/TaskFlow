/**
 * src/api/users/[id]/route.ts
 *
 * Single user resource handler:
 *   GET   /api/users/:id  — Fetch user profile
 *   PATCH /api/users/:id  — Update name, role, avatar
 *
 * Architecture: All business logic here. Next.js bridge at
 * src/app/api/users/[id]/route.ts re-exports these handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { UpdateProfileSchema, validationError } from '@/lib/validators';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Users can only fetch their own profile
    if (session.user.id !== id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          expertise: true,
          createdAt: true,
        },
      });
    } catch (dbErr) {
      console.warn('[GET /api/users/:id] DB query warning, falling back to local store/session:', dbErr);
    }

    if (!user) {
      const { findStoredUserById } = await import('@/data/userStore');
      const stored = findStoredUserById(id);
      if (stored) {
        user = {
          id: stored.id,
          name: stored.name,
          email: stored.email,
          role: stored.role,
          avatar: stored.avatar,
          expertise: [],
          createdAt: new Date(stored.createdAt),
        };
      } else if (session?.user?.id === id) {
        user = {
          id: session.user.id,
          name: session.user.name || 'User',
          email: session.user.email || '',
          role: (session.user as { role?: string }).role || 'User',
          avatar: (session.user as { avatar?: string }).avatar || 'U',
          expertise: [],
          createdAt: new Date(),
        };
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/users/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/users/:id  — Update profile (name, role, avatar, expertise)
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Users can only update their own profile
    if (session.user.id !== id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updateData: { name?: string; role?: string; avatar?: string; expertise?: string[] } = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.role !== undefined && parsed.data.role !== null) updateData.role = parsed.data.role;
    if (parsed.data.avatar !== undefined && parsed.data.avatar !== null) updateData.avatar = parsed.data.avatar;
    if (parsed.data.expertise !== undefined) updateData.expertise = parsed.data.expertise;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        expertise: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/users/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
