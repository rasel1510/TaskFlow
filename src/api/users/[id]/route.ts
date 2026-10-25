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
      const { findStoredUserById, findStoredUserByEmail } = await import('@/data/userStore');
      const stored = findStoredUserById(id) || (session.user.email ? findStoredUserByEmail(session.user.email) : null);
      if (stored) {
        user = {
          id: stored.id,
          name: stored.name,
          email: stored.email,
          role: stored.role,
          avatar: stored.avatar,
          expertise: stored.expertise || [],
          createdAt: new Date(stored.createdAt),
        };

        // Self-heal DB in the background if connection is alive
        try {
          prisma.user.upsert({
            where: { id: stored.id },
            create: {
              id: stored.id,
              name: stored.name,
              email: stored.email.toLowerCase().trim(),
              password: stored.password || null,
              role: stored.role || 'User',
              avatar: stored.avatar || 'U',
              expertise: stored.expertise || [],
              emailVerified: stored.emailVerified ? new Date(stored.emailVerified) : null,
              createdAt: new Date(stored.createdAt),
            },
            update: {},
          }).catch(() => {});
        } catch (_) {}
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

    const { findStoredUserById, findStoredUserByEmail, updateStoredUser } = await import('@/data/userStore');
    const stored = findStoredUserById(id) || (session.user.email ? findStoredUserByEmail(session.user.email) : null);

    let updatedPrismaUser = null;

    try {
      // 1. Check if user exists by id in DB
      const dbUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true },
      });

      if (dbUser) {
        updatedPrismaUser = await prisma.user.update({
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
      } else {
        // User not found by id in DB. Check by email or provision record
        const userEmail = (stored?.email || session.user.email || '').toLowerCase().trim();
        let dbUserByEmail = null;
        if (userEmail) {
          dbUserByEmail = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true },
          });
        }

        if (dbUserByEmail) {
          updatedPrismaUser = await prisma.user.update({
            where: { id: dbUserByEmail.id },
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
        } else if (userEmail) {
          // Provision in Prisma with custom id to preserve relations
          updatedPrismaUser = await prisma.user.create({
            data: {
              id,
              name: updateData.name ?? stored?.name ?? session.user.name ?? 'User',
              email: userEmail,
              role: updateData.role ?? stored?.role ?? (session.user as { role?: string })?.role ?? 'User',
              avatar: updateData.avatar ?? stored?.avatar ?? (session.user as { avatar?: string })?.avatar ?? 'U',
              expertise: updateData.expertise ?? stored?.expertise ?? [],
              password: stored?.password || null,
              emailVerified: stored?.emailVerified ? new Date(stored.emailVerified) : null,
              createdAt: stored?.createdAt ? new Date(stored.createdAt) : new Date(),
            },
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
        }
      }
    } catch (dbError) {
      console.warn('[PATCH /api/users/:id] Prisma update error, falling back to userStore:', dbError);
    }

    // Always update local store if applicable
    const updatedStored = updateStoredUser(id, {
      ...(updateData.name !== undefined && { name: updateData.name }),
      ...(updateData.role !== undefined && { role: updateData.role }),
      ...(updateData.avatar !== undefined && { avatar: updateData.avatar }),
      ...(updateData.expertise !== undefined && { expertise: updateData.expertise }),
    });

    const responseData = updatedPrismaUser || {
      id,
      name: updateData.name ?? updatedStored?.name ?? session.user.name ?? 'User',
      email: updatedStored?.email ?? session.user.email ?? '',
      role: updateData.role ?? updatedStored?.role ?? (session.user as { role?: string })?.role ?? 'User',
      avatar: updateData.avatar ?? updatedStored?.avatar ?? (session.user as { avatar?: string })?.avatar ?? 'U',
      expertise: updateData.expertise ?? updatedStored?.expertise ?? [],
      createdAt: updatedStored?.createdAt ? new Date(updatedStored.createdAt) : new Date(),
    };

    return NextResponse.json({ success: true, data: responseData }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/users/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
