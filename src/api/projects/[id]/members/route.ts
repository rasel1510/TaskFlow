/**
 * src/api/projects/[id]/members/route.ts
 *
 * Project-Scoped RBAC & Team Management (Step 4.10)
 * Manages project member roles: OWNER > LEAD > CONTRIBUTOR > VIEWER
 *
 * GET    /api/projects/:id/members          — List all project members with roles
 * POST   /api/projects/:id/members          — Add/invite a user to the project with a role
 * PATCH  /api/projects/:id/members          — Change a member's role
 * DELETE /api/projects/:id/members?uid=...  — Remove a member from the project
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { ProjectMemberInviteSchema, ProjectMemberUpdateSchema, validationError } from '@/lib/validators';
import { ROLE_DESCRIPTIONS, type ProjectRole } from '@/lib/permissions';
import { users as mockUsers } from '@/data/mockData';
import { getAllStoredUsers } from '@/data/userStore';

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

// In-memory member store for demo resilience (keyed by projectId)
const mockMembersStore: Map<string, MemberRecord[]> = new Map([
  [
    'proj-1',
    [
      {
        userId: 'user-1',
        projectId: 'proj-1',
        role: 'OWNER',
        joinedAt: '2026-09-01T00:00:00.000Z',
        name: 'Alex Johnson',
        email: 'alex@flowsync.dev',
        avatar: 'AJ',
        userRole: 'Engineering Lead',
        expertise: ['Frontend', 'UI Design'],
      },
      {
        userId: 'user-2',
        projectId: 'proj-1',
        role: 'CONTRIBUTOR',
        joinedAt: '2026-09-05T00:00:00.000Z',
        name: 'Sarah Chen',
        email: 'sarah@flowsync.dev',
        avatar: 'SC',
        userRole: 'Senior Developer',
        expertise: ['React', 'TypeScript'],
      },
      {
        userId: 'user-3',
        projectId: 'proj-1',
        role: 'VIEWER',
        joinedAt: '2026-09-10T00:00:00.000Z',
        name: 'Marcus Brown',
        email: 'marcus@flowsync.dev',
        avatar: 'MB',
        userRole: 'Designer',
        expertise: ['UI/UX', 'Figma'],
      },
    ],
  ],
]);

function seedProjectMembers(projectId: string): void {
  if (!mockMembersStore.has(projectId)) {
    const allUsers = [...mockUsers, ...getAllStoredUsers()];
    const seed: MemberRecord[] = allUsers.slice(0, 3).map((u, i) => ({
      userId: u.id,
      projectId,
      role: i === 0 ? 'OWNER' : i === 1 ? 'LEAD' : 'CONTRIBUTOR',
      joinedAt: new Date().toISOString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar || u.name.slice(0, 2).toUpperCase(),
      userRole: u.role || 'Member',
      expertise: (u as { expertise?: string[] }).expertise || [],
    }));
    mockMembersStore.set(projectId, seed);
  }
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/members
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    seedProjectMembers(projectId);

    try {
      const dbMembers = await prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true } },
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (dbMembers && dbMembers.length > 0) {
        const formatted: MemberRecord[] = dbMembers.map((m) => ({
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
        return NextResponse.json({ success: true, data: formatted }, { status: 200 });
      }
    } catch (dbErr) {
      console.warn('[GET /api/projects/:id/members] DB warning, using mock store:', dbErr);
    }

    const members = mockMembersStore.get(projectId) || [];
    return NextResponse.json(
      { success: true, data: members.map(m => ({ ...m, roleConfig: ROLE_DESCRIPTIONS[m.role] })) },
      { status: 200 }
    );
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
    seedProjectMembers(projectId);

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

    // Look up user details
    const allUsers = [...mockUsers, ...getAllStoredUsers()];
    const targetUser = allUsers.find(u => u.id === userId || u.email === userId);
    let dbUser: { id: string; name: string; email: string; avatar?: string; role?: string } | null = null;

    try {
      dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true, role: true, expertise: true },
      });
    } catch {}

    const userInfo = dbUser || targetUser;
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found. Ensure the user ID or email is valid.' } },
        { status: 404 }
      );
    }

    const resolvedUserId = dbUser?.id || targetUser?.id || userId;
    const members = mockMembersStore.get(projectId) || [];

    // Idempotency: if already a member, update role instead
    const existingIdx = members.findIndex(m => m.userId === resolvedUserId);
    const newMember: MemberRecord = {
      userId: resolvedUserId,
      projectId,
      role,
      joinedAt: existingIdx >= 0 ? members[existingIdx].joinedAt : new Date().toISOString(),
      name: userInfo.name,
      email: userInfo.email || '',
      avatar: userInfo.avatar || userInfo.name.slice(0, 2).toUpperCase(),
      userRole: userInfo.role || 'Member',
      expertise: (userInfo as any)?.expertise || (targetUser as any)?.expertise || [],
    };

    if (existingIdx >= 0) {
      members[existingIdx] = newMember;
    } else {
      members.push(newMember);
    }
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
      await prisma.notification.create({
        data: {
          userId: resolvedUserId,
          type: 'member_added',
          title: 'Added to Project',
          body: `You have been added to "${project?.name || 'a project'}" as a ${role}.`,
        },
      });
      const redis = (await import('@/lib/redis')).default;
      await redis.delPattern('projects:*');
    } catch (dbErr) {
      console.warn('[POST /api/projects/:id/members] DB warning, saving to memory:', dbErr);
    }

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

    const members = mockMembersStore.get(projectId) || [];
    const member = members.find(m => m.userId === targetUserId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found in this project' } },
        { status: 404 }
      );
    }

    member.role = parsed.data.role;
    return NextResponse.json(
      { success: true, data: { ...member, roleConfig: ROLE_DESCRIPTIONS[member.role] } },
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
    const members = mockMembersStore.get(projectId) || [];
    const target = members.find(m => m.userId === targetUserId);
    if (target?.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot remove the project OWNER. Transfer ownership first.' } },
        { status: 403 }
      );
    }

    const filtered = members.filter(m => m.userId !== targetUserId);
    mockMembersStore.set(projectId, filtered);

    try {
      await prisma.projectMember.deleteMany({
        where: { projectId, userId: targetUserId },
      });
      const redis = (await import('@/lib/redis')).default;
      await redis.delPattern('projects:*');
    } catch (dbErr) {
      console.warn('[DELETE /api/projects/:id/members] DB warning:', dbErr);
    }

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
