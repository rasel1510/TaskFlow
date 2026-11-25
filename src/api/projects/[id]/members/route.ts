/**
 * src/api/projects/[id]/members/route.ts
 *
 * Project-Scoped RBAC & Team Management
 * Manages project member roles: Admin > Project Manager > Member
 *
 * GET    /api/projects/:id/members          — List all project members with roles
 * POST   /api/projects/:id/members          — Add/invite a user to the project with a role
 * PATCH  /api/projects/:id/members          — Change a member's role
 * DELETE /api/projects/:id/members?uid=...  — Remove a member from the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireProjectAccess } from '@/lib/access';
import prisma from '@/lib/prisma';
import { recipientsWanting, wantsNotification } from '@/lib/notificationPrefs';
import { joinCompany, toCompanyRole } from '@/lib/companyMembership';
import { inTeam } from '@/lib/workspaces';
import { personalNoInvitesResponse } from '@/lib/workspaces';
import {
  ProjectMemberInviteSchema,
  BatchProjectMemberInviteSchema,
  ProjectMemberUpdateSchema,
  validationError,
} from '@/lib/validators';
import { ROLE_DESCRIPTIONS, type ProjectRole, normalizeDesignation } from '@/lib/permissions';
import redisCache from '@/lib/redis';
import { getOrProvisionUserTeam } from '@/lib/tenant';

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
  roleConfig?: any;
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/members
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    // Multi-tenant check: ensure caller belongs to project's company
    try {
      const session = await auth();
      const sessionUserId = session?.user?.id;
      if (sessionUserId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { teamId: true, ownerId: true },
        });
        if (project?.teamId) {
          const callerTeam = await getOrProvisionUserTeam(sessionUserId);
          if (callerTeam?.teamId && callerTeam.teamId !== project.teamId) {
            const isMember = await prisma.projectMember.findUnique({
              where: { projectId_userId: { projectId, userId: sessionUserId } },
              select: { role: true },
            });
            if (!isMember && project.ownerId !== sessionUserId) {
              return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: Project belongs to another organization' } },
                { status: 403 }
              );
            }
          }
        }
      }
    } catch (_) {}

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
        role: toCompanyRole(m.role) as ProjectRole,
        joinedAt: m.joinedAt.toISOString(),
        name: m.user?.name || 'Unknown',
        email: m.user?.email || '',
        avatar: m.user?.avatar || (m.user?.name?.slice(0, 2).toUpperCase() || '?'),
        userRole: normalizeDesignation(m.user?.role),
        expertise: m.user?.expertise || [],
      }));

      return NextResponse.json(
        { success: true, data: formatted.map(m => ({ ...m, roleConfig: ROLE_DESCRIPTIONS[m.role] })) },
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        }
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
// POST /api/projects/:id/members — Add member(s) from existing users
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    // 1. Session verification & RBAC check
    let sessionUserId: string | undefined;
    let sessionUserRole: string | undefined;
    try {
      const session = await auth();
      sessionUserId = session?.user?.id;
      sessionUserRole = (session?.user as { role?: string })?.role;
    } catch (_) {}

    // Verify project exists
    let project: { id: string; name: string; ownerId: string; teamId: string | null } | null = null;
    try {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, ownerId: true, teamId: true },
      });
    } catch (_) {}
    if (project?.teamId) {
      const personalBlock = await personalNoInvitesResponse(project.teamId);
      if (personalBlock) return personalBlock;
    }

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Resolve caller's team context
    const callerTeam = sessionUserId ? await getOrProvisionUserTeam(sessionUserId) : null;
    const projectTeamId = project.teamId || callerTeam?.teamId;

    if (project.teamId && callerTeam?.teamId && project.teamId !== callerTeam.teamId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify project belonging to another organization' } },
        { status: 403 }
      );
    }

    if (sessionUserId) {
      const isAdmin =
        sessionUserRole === 'Admin' ||
        sessionUserRole === 'ADMIN' ||
        sessionUserRole?.toLowerCase() === 'admin';
      const isProjectManager =
        sessionUserRole === 'Project Manager' ||
        sessionUserRole === 'PROJECT_MANAGER' ||
        sessionUserRole?.toLowerCase() === 'project manager';
      const isOwner = project.ownerId === sessionUserId;

      let isProjectLead = false;
      if (!isAdmin && !isProjectManager && !isOwner) {
        try {
          const memberRecord = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: sessionUserId } },
            select: { role: true },
          });
          const projectRole = toCompanyRole(memberRecord?.role);
          isProjectLead = projectRole === 'Admin' || projectRole === 'Project Manager';
        } catch (_) {}
      }

      if (!isAdmin && !isProjectManager && !isOwner && !isProjectLead) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Only workspace administrators, project managers, or project leads can add members to this project.',
            },
          },
          { status: 403 }
        );
      }
    }

    // 2. Parse request body (supports single { userId, role } OR batch { members: [...] })
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request body' } },
        { status: 400 }
      );
    }

    let isBatch = false;
    let membersToAdd: Array<{ userId: string; role: ProjectRole }> = [];

    if (body && typeof body === 'object' && 'members' in body && Array.isArray((body as any).members)) {
      isBatch = true;
      const parsedBatch = BatchProjectMemberInviteSchema.safeParse(body);
      if (!parsedBatch.success) return validationError(parsedBatch.error);
      membersToAdd = parsedBatch.data.members as Array<{ userId: string; role: ProjectRole }>;
    } else {
      const parsedSingle = ProjectMemberInviteSchema.safeParse(body);
      if (!parsedSingle.success) return validationError(parsedSingle.error);
      membersToAdd = [parsedSingle.data as { userId: string; role: ProjectRole }];
    }

    if (membersToAdd.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'At least one team member must be provided' } },
        { status: 400 }
      );
    }

    // Deduplicate member inputs by userId; roles are always Admin / Project Manager / Member
    const uniqueInputs = new Map<string, ProjectRole>();
    for (const item of membersToAdd) {
      uniqueInputs.set(item.userId.trim(), toCompanyRole(item.role));
    }

    // Only the project owner or a company Admin can make someone an Admin
    if (Array.from(uniqueInputs.values()).includes('Admin')) {
      const canGrantAdmin =
        project.ownerId === sessionUserId || (sessionUserRole || '').toLowerCase() === 'admin';
      if (!canGrantAdmin) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Only the project owner or a company Admin can add someone as an Admin.' } },
          { status: 403 }
        );
      }
    }

    const requestedUserIds = Array.from(uniqueInputs.keys());

    // 3. Batch resolve candidate users strictly belonging to this company's team (O(N) lookup)
    let dbUsers: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      role?: string | null;
      expertise?: string[] | null;
    }> = [];

    try {
      dbUsers = await prisma.user.findMany({
        where: {
          AND: [
            ...(projectTeamId ? [inTeam(projectTeamId)] : []),
            {
              OR: [
                { id: { in: requestedUserIds } },
                { email: { in: requestedUserIds } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          expertise: true,
        },
      });
    } catch (err) {
      console.warn('[POST /api/projects/:id/members] User lookup warning:', err);
    }

    const resolvedUserMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      avatar: string;
      role: string;
      expertise: string[];
    }>();

    for (const u of dbUsers) {
      resolvedUserMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || u.name.slice(0, 2).toUpperCase(),
        role: u.role || 'Member',
        expertise: u.expertise || [],
      });
      resolvedUserMap.set(u.email.toLowerCase(), {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar || u.name.slice(0, 2).toUpperCase(),
        role: u.role || 'Member',
        expertise: u.expertise || [],
      });
    }

    // 4. Enroll each valid member into project
    const addedMembers: MemberRecord[] = [];

    for (const [rawId, memberRole] of uniqueInputs.entries()) {
      const userInfo = resolvedUserMap.get(rawId) || resolvedUserMap.get(rawId.toLowerCase());
      if (!userInfo) {
        continue;
      }

      const targetUserId = userInfo.id;

      try {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: targetUserId } },
          create: {
            projectId,
            userId: targetUserId,
            role: memberRole,
          },
          update: {
            role: memberRole,
          },
        });

        // Anyone added to a company's project is part of that company, with this role
        await joinCompany(targetUserId, projectTeamId, memberRole).catch(() => 'skipped');

        // Dispatch in-app notification to member (no email sending needed)
        try {
          if (await wantsNotification(targetUserId, 'project_activity'))
          await prisma.notification.create({
            data: {
              userId: targetUserId,
              type: 'member_added',
              title: 'Added to Project',
              body: `You have been added directly to "${project.name}" as a ${ROLE_DESCRIPTIONS[memberRole]?.label || memberRole}.`,
            },
          });
        } catch (_) {}

        addedMembers.push({
          userId: targetUserId,
          projectId,
          role: memberRole,
          joinedAt: new Date().toISOString(),
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.avatar,
          userRole: userInfo.role,
          expertise: userInfo.expertise,
        });
      } catch (upsertErr) {
        console.warn(`[POST /api/projects/:id/members] Upsert error for user ${targetUserId}:`, upsertErr);
      }
    }

    // Invalidate Redis cache
    try {
      await Promise.all([redisCache.delPattern('projects:*'), redisCache.delPattern('team:members:*')]);
    } catch (_) {}

    if (addedMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'None of the provided users could be found or enrolled.' } },
        { status: 404 }
      );
    }

    if (isBatch) {
      return NextResponse.json(
        {
          success: true,
          data: {
            count: addedMembers.length,
            members: addedMembers.map((m) => ({ ...m, roleConfig: ROLE_DESCRIPTIONS[m.role] })),
          },
        },
        { status: 201 }
      );
    }

    const singleMember = addedMembers[0];
    return NextResponse.json(
      {
        success: true,
        data: {
          ...singleMember,
          roleConfig: ROLE_DESCRIPTIONS[singleMember.role],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/members] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add member(s) to project' } },
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

    // Multi-tenant & Admin authorization check
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const sessionUserRole = (session?.user as { role?: string })?.role;

    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let project = null;
    try {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true, ownerId: true },
      });
      if (project?.teamId) {
        const callerTeam = await getOrProvisionUserTeam(sessionUserId);
        if (callerTeam?.teamId && callerTeam.teamId !== project.teamId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify project belonging to another organization' } },
            { status: 403 }
          );
        }
      }
    } catch (_) {}

    const isAdmin =
      sessionUserRole === 'Admin' ||
      sessionUserRole === 'ADMIN' ||
      sessionUserRole?.toLowerCase() === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only workspace administrators have the power to change member roles.',
          },
        },
        { status: 403 }
      );
    }

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

    // Multi-tenant & Admin authorization check
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const sessionUserRole = (session?.user as { role?: string })?.role;

    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let project = null;
    try {
      project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true, ownerId: true },
      });
      if (project?.teamId) {
        const callerTeam = await getOrProvisionUserTeam(sessionUserId);
        if (callerTeam?.teamId && callerTeam.teamId !== project.teamId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify project belonging to another organization' } },
            { status: 403 }
          );
        }
      }
    } catch (_) {}

    const isAdmin =
      sessionUserRole === 'Admin' ||
      sessionUserRole === 'ADMIN' ||
      sessionUserRole?.toLowerCase() === 'admin';

    const isAuthorized =
      isAdmin ||
      project?.ownerId === sessionUserId ||
      sessionUserRole === 'Project Manager' ||
      sessionUserRole === 'PROJECT_MANAGER' ||
      sessionUserRole?.toLowerCase() === 'project manager';

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only workspace administrators or project managers can remove members from a project.',
          },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('uid');

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Member user ID parameter (?uid=...) is required' } },
        { status: 400 }
      );
    }

    // The project owner can't be removed
    if (project?.ownerId && project.ownerId === targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: "The project owner can't be removed. Transfer ownership first." } },
        { status: 403 }
      );
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId: targetUserId },
    });

    await Promise.all([
      redisCache.delPattern('projects:*'),
      redisCache.delPattern('team:members:*'),
    ]).catch(() => {});

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
