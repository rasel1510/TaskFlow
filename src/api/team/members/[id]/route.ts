import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { updateStoredUser } from '@/data/userStore';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UpdateRoleSchema = z.object({
  role: z
    .string()
    .min(1, 'Role / Job title cannot be empty')
    .max(100, 'Role / Job title must be 100 characters or fewer')
    .trim(),
});

// ---------------------------------------------------------------------------
// PATCH /api/team/members/:id — Admin updates a member's role or job title
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = (session?.user as { role?: string })?.role;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id: targetMemberId } = await context.params;

    // Check if requester is Admin (cross-check DB to prevent session staleness)
    let isAdmin =
      currentUserRole === 'Admin' ||
      currentUserRole === 'ADMIN' ||
      currentUserRole?.toLowerCase() === 'admin';

    if (!isAdmin) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { role: true },
        });
        if (dbUser?.role?.toLowerCase() === 'admin') {
          isAdmin = true;
        }
      } catch (_) {}
    }

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Team Administrators can modify member roles and job titles' } },
        { status: 403 }
      );
    }

    const teamContext = await getOrProvisionUserTeam(currentUserId);
    if (!teamContext) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEAM', message: 'Team workspace not found' } },
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } },
        { status: 422 }
      );
    }

    const { role: newRole } = parsed.data;

    // Ensure target member belongs to the same team
    const targetMember = await prisma.user.findFirst({
      where: {
        id: targetMemberId,
        teamId: teamContext.teamId,
      },
    });

    if (!targetMember) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found in your team' } },
        { status: 404 }
      );
    }

    // Safety check: Cannot demote the last admin
    if (targetMember.role.toLowerCase() === 'admin' && newRole.toLowerCase() !== 'admin') {
      const adminCount = await prisma.user.count({
        where: {
          teamId: teamContext.teamId,
          role: { in: ['Admin', 'ADMIN', 'admin'] },
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: { code: 'LAST_ADMIN', message: 'Cannot demote the last Administrator in the team' } },
          { status: 400 }
        );
      }
    }

    // Update in database
    const updated = await prisma.user.update({
      where: { id: targetMemberId },
      data: { role: newRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        expertise: true,
      },
    });

    // Update local user store for resilience
    try {
      updateStoredUser(targetMemberId, { role: newRole });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Role for ${updated.name} updated to ${newRole}`,
    });
  } catch (error) {
    console.error('[PATCH /api/team/members/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/team/members/:id — Admin removes a member from the team
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;
    const currentUserRole = (session?.user as { role?: string })?.role;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id: targetMemberId } = await context.params;

    const isAdmin =
      currentUserRole === 'Admin' ||
      currentUserRole === 'ADMIN' ||
      currentUserRole?.toLowerCase() === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Team Administrators can remove members' } },
        { status: 403 }
      );
    }

    const teamContext = await getOrProvisionUserTeam(currentUserId);
    if (!teamContext) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEAM', message: 'Team workspace not found' } },
        { status: 404 }
      );
    }

    // Cannot remove self if only admin
    if (targetMemberId === currentUserId) {
      const adminCount = await prisma.user.count({
        where: {
          teamId: teamContext.teamId,
          role: 'Admin',
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, error: { code: 'CANNOT_REMOVE_SELF', message: 'You are the only Administrator. Promote another member before leaving.' } },
          { status: 400 }
        );
      }
    }

    // Unlink member from team
    await prisma.user.updateMany({
      where: {
        id: targetMemberId,
        teamId: teamContext.teamId,
      },
      data: {
        teamId: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from team',
    });
  } catch (error) {
    console.error('[DELETE /api/team/members/:id] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member from team' } },
      { status: 500 }
    );
  }
}
