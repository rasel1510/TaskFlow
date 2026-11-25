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
import { normalizeDesignation, isSuperAdmin } from '@/lib/permissions';
import { UpdateProfileSchema, validationError } from '@/lib/validators';
import { isCompanyRole, toCompanyRole } from '@/lib/companyRoles';
import { inTeam } from '@/lib/workspaces';

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
      console.warn('[GET /api/users/:id] DB query failed:', dbErr);
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

    const currentUserId = session.user.id;
    const sessionRole = (session.user as { role?: string })?.role;

    // Check if requester is Admin (cross-check with DB to prevent session staleness)
    let isRequesterAdmin =
      sessionRole === 'Admin' ||
      sessionRole === 'ADMIN' ||
      sessionRole?.toLowerCase() === 'admin';

    if (!isRequesterAdmin) {
      try {
        const dbRequester = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { role: true },
        });
        if (dbRequester?.role?.toLowerCase() === 'admin') {
          isRequesterAdmin = true;
        }
      } catch (_) {}
    }

    // 1. Authorization: Only administrators can update another user's profile
    if (currentUserId !== id && !isRequesterAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: Only administrators can modify other members' } },
        { status: 403 }
      );
    }

    // Tenant check if updating another user: target must be in the requester's own company
    if (currentUserId !== id) {
      const { getOrProvisionUserTeam } = await import('@/lib/tenant');
      const teamContext = await getOrProvisionUserTeam(currentUserId).catch(() => null);
      const targetInTeam = teamContext?.teamId
        ? await prisma.user.findFirst({
            where: { id, ...inTeam(teamContext.teamId) },
            select: { id: true },
          })
        : null;
      if (!targetInTeam) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify member from another workspace' } },
          { status: 403 }
        );
      }
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

    // 2. Role security: ONLY administrators can change a role (Admin / Project Manager / Member)
    const newRole = parsed.data.role;
    const isAttemptingRoleChange = newRole !== undefined && newRole !== null;

    // Platform-level Super Admin can never be granted from a workspace profile edit
    if (
      isAttemptingRoleChange &&
      typeof newRole === 'string' &&
      normalizeDesignation(newRole) === 'Super Admin' &&
      !isSuperAdmin(session?.user as { email?: string; role?: string; teamName?: string } | undefined)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'The Super Admin role cannot be assigned here' } },
        { status: 403 }
      );
    }
    // Companies use exactly three roles: Admin, Project Manager, Member
    if (isAttemptingRoleChange && typeof newRole === 'string' && !isCompanyRole(newRole) && normalizeDesignation(newRole) !== 'Super Admin') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Role must be Admin, Project Manager or Member' } },
        { status: 400 }
      );
    }
    if (isAttemptingRoleChange && typeof newRole === 'string') {
      if (!isRequesterAdmin) {
        // Fetch target user's current role
        let currentTargetRole = sessionRole;
        try {
          const existing = await prisma.user.findUnique({
            where: { id },
            select: { role: true },
          });
          if (existing?.role) currentTargetRole = existing.role;
        } catch (_) {}

        if (newRole.trim().toLowerCase() !== currentTargetRole?.trim().toLowerCase()) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Only workspace administrators can change roles.',
              },
            },
            { status: 403 }
          );
        }
      } else {
        // Safety check: Cannot demote the last administrator in the team
        try {
          const target = await prisma.user.findUnique({
            where: { id },
            select: { role: true, teamId: true },
          });

          if (target?.role?.toLowerCase() === 'admin' && toCompanyRole(newRole) !== 'Admin') {
            if (target.teamId) {
              const adminCount = await prisma.teamMembership.count({
                where: {
                  teamId: target.teamId,
                  role: { in: ['Admin', 'ADMIN', 'admin'] },
                },
              });

              if (adminCount <= 1) {
                return NextResponse.json(
                  { success: false, error: { code: 'LAST_ADMIN', message: 'Cannot demote the last Administrator in the workspace' } },
                  { status: 400 }
                );
              }
            }
          }
        } catch (_) {}
      }
    }

    const updateData: { name?: string; role?: string; avatar?: string; expertise?: string[] } = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    // Strictly apply role update only if requester is an administrator!
    if (isRequesterAdmin && parsed.data.role !== undefined && parsed.data.role !== null) {
      updateData.role =
        normalizeDesignation(parsed.data.role) === 'Super Admin' ? 'Super Admin' : toCompanyRole(parsed.data.role);
    }
    if (parsed.data.avatar !== undefined && parsed.data.avatar !== null) updateData.avatar = parsed.data.avatar;
    if (parsed.data.expertise !== undefined) updateData.expertise = parsed.data.expertise;

    // The account must exist — a session for a deleted account never re-creates it
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // A role is per company: record it on the membership in the open company, and mirror it on
    // the person only while that company is the one they have open
    if (updateData.role !== undefined && updateData.role !== 'Super Admin') {
      const actor = await prisma.user.findUnique({ where: { id: currentUserId }, select: { teamId: true } });
      if (actor?.teamId) {
        await prisma.teamMembership.updateMany({ where: { teamId: actor.teamId, userId: id }, data: { role: updateData.role } });
        const target = await prisma.user.findUnique({ where: { id }, select: { teamId: true } });
        if (target?.teamId !== actor.teamId) delete updateData.role;
      }
    }

    const responseData = await prisma.user.update({
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

    return NextResponse.json({ success: true, data: responseData }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/users/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
