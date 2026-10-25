/**
 * src/api/projects/[id]/members/route.ts
 *
 * Project-Scoped RBAC & Team Management
 * Manages project member roles: OWNER > LEAD > CONTRIBUTOR > VIEWER
 *
 * GET    /api/projects/:id/members          — List all project members with roles
 * POST   /api/projects/:id/members          — Add/invite a user to the project with a role
 * PATCH  /api/projects/:id/members          — Change a member's role
 * DELETE /api/projects/:id/members?uid=...  — Remove a member from the project
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ProjectMemberInviteSchema, ProjectMemberUpdateSchema, validationError } from '@/lib/validators';
import { ROLE_DESCRIPTIONS, type ProjectRole } from '@/lib/permissions';
import { getAllStoredUsers } from '@/data/userStore';
import redisCache from '@/lib/redis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface MemberRecord {
  userId: string;
  projectId: string;
  role: ProjectRole;
  joinedAt: string;
  name: string;
  email: string;
  avatar: string;
  userRole: string;
  expertise?: string[];
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/members
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    try {
      const dbMembers = await prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });

      const formatted: MemberRecord[] = (dbMembers || []).map((m) => ({
        userId: m.userId,
        projectId: m.projectId,
        role: m.role as ProjectRole,
        joinedAt: m.joinedAt.toISOString(),
        name: m.user?.name || 'Unknown',
        email: m.user?.email || '',
        avatar: m.user?.avatar || (m.user?.name?.slice(0, 2).toUpperCase() || '?'),
        userRole: m.user?.role || 'Member',
        expertise: m.user?.expertise || [],
      }));

      return NextResponse.json(
        { success: true, data: formatted.map(m => ({ ...m, roleConfig: ROLE_DESCRIPTIONS[m.role] })) },
        { status: 200 }
      );
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id/members] DB warning:', dbErr);
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }
  } catch (error) {
    console.error('[GET /api/projects/:id/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve project members' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/:id/members — Add member
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
        { status: 400 }
      );
    }

    const parsed = ProjectMemberInviteSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { userId, role } = parsed.data;

    // Look up user details from DB or stored users
    let dbUser: { id: string; name: string; email: string; avatar?: string; role?: string; expertise?: string[] } | null = null;
    try {
      dbUser = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { email: userId }] },
        select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
      });
    } catch {}

    const storedUser = !dbUser ? getAllStoredUsers().find(u => u.id === userId || u.email.toLowerCase() === userId.toLowerCase()) : null;
    const userInfo = dbUser || storedUser;

    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found. Ensure the user ID or email is valid.' } },
        { status: 404 }
      );
    }

    const resolvedUserId = userInfo.id;

    try {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: resolvedUserId } },
        create: {
          projectId,
          userId: resolvedUserId,
          role,
        },
        update: {
          role,
        },
      });

      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
      try {
        await prisma.notification.create({
          data: {
            userId: resolvedUserId,
            type: 'member_added',
            title: 'Added to Project',
            body: `You have been added to "${project?.name || 'a project'}" as a ${role}.`,
          },
        });
      } catch {}

      await redisCache.delPattern('projects:*');
    } catch (dbErr) {
      console.warn('[POST /api/projects/:id/members] DB warning:', dbErr);
    }

    const newMember: MemberRecord = {
      userId: resolvedUserId,
      projectId,
      role,
      joinedAt: new Date().toISOString(),
      name: userInfo.name,
      email: userInfo.email || '',
      avatar: userInfo.avatar || userInfo.name.slice(0, 2).toUpperCase(),
      userRole: userInfo.role || 'Member',
      expertise: userInfo.expertise || [],
    };

    return NextResponse.json({ success: true, data: { ...newMember, roleConfig: ROLE_DESCRIPTIONS[role] } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add member' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id/members — Update member role
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
        { status: 400 }
      );
    }

    const targetUserId = (body.userId as string) || (body.uid as string);
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'userId is required in request body' } },
        { status: 400 }
      );
    }

    const parsed = ProjectMemberUpdateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    try {
      await prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId: targetUserId } },
        data: { role: parsed.data.role },
      });
      await redisCache.delPattern('projects:*');
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found in this project' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: { role: parsed.data.role, roleConfig: ROLE_DESCRIPTIONS[parsed.data.role] } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/projects/:id/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id/members?uid=...
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('uid');

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Member user ID parameter (?uid=...) is required' } },
        { status: 400 }
      );
    }

    // Prevent OWNER removal
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      select: { role: true },
    });

    if (existing?.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot remove the project OWNER. Transfer ownership first.' } },
        { status: 403 }
      );
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId: targetUserId },
    });

    await redisCache.delPattern('projects:*');

    return NextResponse.json(
      { success: true, data: { message: 'Member removed from project' } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/projects/:id/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' } },
      { status: 500 }
    );
  }
}
