/**
 * src/lib/access.ts
 *
 * Shared server-side authorization helpers for resource routes.
 *
 * Access rules (mirror GET /api/projects tenant scoping):
 *   - Project: owner, ProjectMember, same team (tenant) as the project, or Super Admin.
 *   - Task:    assignee, creator, or anyone with access to the task's project.
 *              Personal tasks (no project) are visible to assignee/creator only.
 *
 * Every helper returns either the resolved data or a ready-to-return
 * NextResponse (401 / 403 / 404) using the unified error envelope.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { hasProjectPermission, isSuperAdmin } from '@/lib/permissions';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  teamId: string | null;
  isSuperAdmin: boolean;
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export const unauthorized = () => errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
export const forbidden = (message = 'You do not have access to this resource') =>
  errorResponse(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found') => errorResponse(404, 'NOT_FOUND', message);

/** Resolves the signed-in user from the session cookie. Never trusts query params or body. */
export async function getSessionUser(): Promise<SessionUser | null> {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }
  const u = session?.user as
    | { id?: string; email?: string | null; role?: string; teamId?: string; teamName?: string; isSuperAdmin?: boolean }
    | undefined;
  if (!u?.id) return null;

  let teamId = u.teamId || null;
  if (!teamId) {
    // Session may predate team creation — read the authoritative value.
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: u.id }, select: { teamId: true } });
      teamId = dbUser?.teamId ?? null;
    } catch {
      /* fall through with null team */
    }
  }

  return {
    id: u.id,
    email: (u.email || '').toLowerCase().trim(),
    role: u.role || 'Member',
    teamId,
    isSuperAdmin: Boolean(u.isSuperAdmin) || isSuperAdmin({ email: u.email, role: u.role, teamName: u.teamName }),
  };
}

type Result<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

/** Requires a signed-in user. */
export async function requireUser(): Promise<Result<SessionUser>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, value: user };
}

export interface ProjectAccess {
  user: SessionUser;
  project: { id: string; ownerId: string; teamId: string | null };
  isOwner: boolean;
  memberRole: string | null;
}

/** Requires a signed-in user who can see the given project. */
export async function requireProjectAccess(projectId: string): Promise<Result<ProjectAccess>> {
  const userRes = await requireUser();
  if (!userRes.ok) return userRes;
  const user = userRes.value;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      teamId: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });
  if (!project) return { ok: false, response: notFound(`Project "${projectId}" not found`) };

  const isOwner = project.ownerId === user.id;
  const memberRole = project.members[0]?.role ?? null;
  const sameTeam = Boolean(project.teamId && user.teamId && project.teamId === user.teamId);

  if (!(user.isSuperAdmin || isOwner || memberRole || sameTeam)) {
    return { ok: false, response: forbidden() };
  }

  return {
    ok: true,
    value: {
      user,
      project: { id: project.id, ownerId: project.ownerId, teamId: project.teamId },
      isOwner,
      memberRole,
    },
  };
}

export interface TaskAccess {
  user: SessionUser;
  task: { id: string; projectId: string | null; assigneeId: string | null; creatorId: string | null };
}

/** Checks whether an already-resolved user may access a task (no extra auth() call). */
export async function userCanAccessTask(
  user: SessionUser,
  task: { projectId: string | null; assigneeId: string | null; creatorId: string | null }
): Promise<boolean> {
  if (user.isSuperAdmin) return true;
  if (task.assigneeId === user.id || task.creatorId === user.id) return true;
  if (!task.projectId) return false;

  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: {
      ownerId: true,
      teamId: true,
      members: { where: { userId: user.id }, select: { id: true }, take: 1 },
    },
  });
  if (!project) return false;
  return (
    project.ownerId === user.id ||
    project.members.length > 0 ||
    Boolean(project.teamId && user.teamId && project.teamId === user.teamId)
  );
}

/** Requires a signed-in user who can see the given task. */
export async function requireTaskAccess(taskId: string): Promise<Result<TaskAccess>> {
  const userRes = await requireUser();
  if (!userRes.ok) return userRes;
  const user = userRes.value;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, assigneeId: true, creatorId: true },
  });
  if (!task) return { ok: false, response: notFound(`Task with id "${taskId}" was not found`) };

  if (!(await userCanAccessTask(user, task))) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, value: { user, task } };
}

/** True for team Admins / Project Managers (any legacy spelling) or Super Admins. */
export function isManagerRole(user: SessionUser): boolean {
  if (user.isSuperAdmin) return true;
  const r = user.role.toLowerCase().replace(/_/g, ' ').trim();
  return r === 'admin' || r === 'owner' || r === 'project manager';
}

/** Workspace Admin (any legacy spelling) or Super Admin. */
function isAdminRole(user: SessionUser): boolean {
  if (user.isSuperAdmin) return true;
  const r = user.role.toLowerCase().replace(/_/g, ' ').trim();
  return r === 'admin' || r === 'owner';
}

function isSameTeam(a: ProjectAccess): boolean {
  return Boolean(a.project.teamId && a.user.teamId && a.project.teamId === a.user.teamId);
}

/**
 * Full control of a project (settings, columns, members, deletion):
 *  - the project owner and Super Admins
 *  - members whose project role is OWNER / Admin
 *  - workspace Admins of the project's own company, and workspace Admins who were added to the project
 */
export function isProjectAdmin(a: ProjectAccess): boolean {
  if (a.user.isSuperAdmin || a.isOwner) return true;
  if (hasProjectPermission(a.memberRole, 'Admin')) return true;
  return isAdminRole(a.user) && (isSameTeam(a) || Boolean(a.memberRole));
}

/**
 * May this user change project settings, columns, milestones and invitations?
 * Everyone with full control (see isProjectAdmin), plus project leads / managers and
 * Project Managers of the project's own company.
 */
export function canManageProject(a: ProjectAccess): boolean {
  if (isProjectAdmin(a)) return true;
  if (hasProjectPermission(a.memberRole, 'Project Manager')) return true;
  return isSameTeam(a) && isManagerRole(a.user);
}
