/**
 * src/lib/workspaces.ts
 *
 * A person can belong to several workspaces:
 *   - their own Personal workspace (just them; 14-day free trial, or free use approved by the
 *     Super Admin), created the first time they open it — one per person, so one trial per person
 *   - any number of companies (teams) they create or are invited to, each with its own role
 *
 * Memberships (TeamMembership) list every workspace someone belongs to. User.teamId / User.role /
 * User.plan mirror the workspace that is currently open, so the rest of the app keeps working
 * exactly as before — scoped to the open workspace. Switching workspace rewrites that mirror.
 *
 * Companies never see people outside their own memberships: there is no people directory; a
 * company can only invite an exact email address.
 */

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { toCompanyRole } from '@/lib/companyRoles';

export const PERSONAL_TRIAL_DAYS = 14;
const DAY_MS = 86_400_000;

export type WorkspaceKind = 'company' | 'personal';
/** company = a team · trial / free / expired = the personal workspace's access */
export type WorkspaceState = 'company' | 'trial' | 'free' | 'expired';

export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: WorkspaceKind;
  role: string;
  state: WorkspaceState;
  trialEndsAt: string | null;
  daysLeft: number | null;
  freeAccess: string;
  writable: boolean;
}

type TeamFields = {
  id: string;
  name: string;
  kind: string;
  trialEndsAt: Date | null;
  freeAccess: string;
};

const TEAM_SELECT = { id: true, name: true, kind: true, trialEndsAt: true, freeAccess: true } as const;

/** Prisma filter for "people in this company" (members, wherever they are working right now). */
export function inTeam(teamId: string): Prisma.UserWhereInput {
  return { workspaceMemberships: { some: { teamId } } };
}

const isSuperAdminRole = (role: string | null | undefined) =>
  (role || '').toLowerCase().replace(/_/g, ' ').trim() === 'super admin';

export function describeWorkspace(team: TeamFields, role = 'Admin'): WorkspaceSummary {
  if (team.kind !== 'personal') {
    return { id: team.id, name: team.name, kind: 'company', role, state: 'company', trialEndsAt: null, daysLeft: null, freeAccess: 'none', writable: true };
  }
  const now = Date.now();
  const ends = team.trialEndsAt ? team.trialEndsAt.getTime() : now;
  const state: WorkspaceState = team.freeAccess === 'approved' ? 'free' : ends > now ? 'trial' : 'expired';
  return {
    id: team.id,
    name: 'Personal',
    kind: 'personal',
    role: 'Admin',
    state,
    trialEndsAt: team.trialEndsAt ? team.trialEndsAt.toISOString() : null,
    daysLeft: state === 'trial' ? Math.max(1, Math.ceil((ends - now) / DAY_MS)) : null,
    freeAccess: team.freeAccess,
    writable: state !== 'expired',
  };
}

async function clearCaches(userId: string) {
  await Promise.all([
    redisCache.del(`tenant:${userId}`).catch(() => {}),
    redisCache.delPattern('team:members:*').catch(() => {}),
    redisCache.delPattern('projects:*').catch(() => {}),
    redisCache.delPattern('tasks:*').catch(() => {}),
  ]);
}

/** The person's Personal workspace, created (and its 14-day trial started) on first use. */
export async function ensurePersonalWorkspace(userId: string) {
  const existing = await prisma.team.findUnique({ where: { personalOwnerId: userId }, select: TEAM_SELECT });
  if (existing) {
    await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: existing.id, userId } },
      create: { teamId: existing.id, userId, role: 'Admin' },
      update: {},
    });
    return existing;
  }
  try {
    const team = await prisma.team.create({
      data: {
        name: 'Personal',
        slug: `personal-${userId}`,
        kind: 'personal',
        personalOwnerId: userId,
        trialEndsAt: new Date(Date.now() + PERSONAL_TRIAL_DAYS * DAY_MS),
        memberships: { create: { userId, role: 'Admin' } },
      },
      select: TEAM_SELECT,
    });
    return team;
  } catch (err) {
    // Two requests raced to create it — use the one that won
    if ((err as { code?: string })?.code === 'P2002') {
      const won = await prisma.team.findUnique({ where: { personalOwnerId: userId }, select: TEAM_SELECT });
      if (won) return won;
    }
    throw err;
  }
}

/** Adds someone to a company (keeps their existing role if they are already a member). */
export async function addMembership(userId: string, teamId: string, role: string): Promise<'added' | 'existing'> {
  const existing = await prisma.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { id: true } });
  if (existing) return 'existing';
  await prisma.teamMembership.create({ data: { teamId, userId, role: toCompanyRole(role) } });
  await clearCaches(userId);
  return 'added';
}

/**
 * Opens a workspace for the person (the target must be one of their memberships, or 'personal').
 * Rewrites the "open workspace" mirror on the User row: teamId, role, plan, subscription status.
 */
export async function switchWorkspace(userId: string, target: string | 'personal'): Promise<WorkspaceSummary | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, pendingTeamPlan: true } });
  if (!user) return null;

  let teamId = target;
  if (target === 'personal') teamId = (await ensurePersonalWorkspace(userId)).id;

  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true, team: { select: { ...TEAM_SELECT, plan: true, subscriptionStatus: true } } },
  });
  if (!membership) return null;
  const team = membership.team;
  const personal = team.kind === 'personal';

  await prisma.user.update({
    where: { id: userId },
    data: {
      teamId: team.id,
      // The platform owner keeps their Super Admin role everywhere
      role: isSuperAdminRole(user.role) ? user.role : personal ? 'Admin' : toCompanyRole(membership.role),
      // In Personal, "plan" is the plan picked for a team still being created; in a company it is the company's plan
      plan: personal ? user.pendingTeamPlan || 'free' : team.plan,
      subscriptionStatus: personal ? 'active' : team.subscriptionStatus,
      hasCompletedOnboarding: true,
    },
  });
  await clearCaches(userId);
  return describeWorkspace(team, personal ? 'Admin' : toCompanyRole(membership.role));
}

/** Removes someone from a company; if it was the open workspace, opens another one (or Personal). */
export async function removeMembership(userId: string, teamId: string): Promise<void> {
  await prisma.teamMembership.deleteMany({ where: { userId, teamId } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
  if (user?.teamId === teamId) {
    const next = await prisma.teamMembership.findFirst({
      where: { userId, team: { kind: 'company' } },
      orderBy: { createdAt: 'asc' },
      select: { teamId: true },
    });
    await switchWorkspace(userId, next?.teamId ?? 'personal');
  }
  await clearCaches(userId);
}

/** Every workspace the person belongs to — Personal first (offered even before it exists). */
export async function listWorkspaces(userId: string): Promise<{ active: string | null; workspaces: WorkspaceSummary[] }> {
  const [user, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } }),
    prisma.teamMembership.findMany({
      where: { userId },
      select: { role: true, team: { select: TEAM_SELECT } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);
  const list = memberships.map(m => describeWorkspace(m.team, toCompanyRole(m.role)));
  const personal = list.filter(w => w.kind === 'personal');
  const companies = list.filter(w => w.kind === 'company').sort((a, b) => a.name.localeCompare(b.name));
  const workspaces = [
    ...(personal.length
      ? personal
      : [{ id: 'personal', name: 'Personal', kind: 'personal' as const, role: 'Admin', state: 'trial' as const, trialEndsAt: null, daysLeft: PERSONAL_TRIAL_DAYS, freeAccess: 'none', writable: true }]),
    ...companies,
  ];
  return { active: user?.teamId ?? null, workspaces };
}

/** The open workspace's description (null when the person has none yet). */
export async function activeWorkspace(teamId: string | null | undefined): Promise<WorkspaceSummary | null> {
  if (!teamId) return null;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: TEAM_SELECT });
  return team ? describeWorkspace(team) : null;
}

/** 403 response when the workspace is a Personal workspace whose trial ended (read-only), else null. */
export async function readOnlyResponse(teamId: string | null | undefined): Promise<NextResponse | null> {
  const ws = await activeWorkspace(teamId);
  if (!ws || ws.writable) return null;
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'TRIAL_ENDED',
        message: 'Your free trial has ended, so this workspace is read-only. Request free use or create a team to continue.',
      },
    },
    { status: 403 }
  );
}

/** Read-only check for work that lives in a project (uses the project's workspace) or, without one, the open workspace. */
export async function readOnlyResponseFor(projectId: string | null | undefined, openTeamId: string | null | undefined): Promise<NextResponse | null> {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } });
    if (project?.teamId) return readOnlyResponse(project.teamId);
  }
  return readOnlyResponse(openTeamId);
}

/** 403 response when the workspace is Personal (only you — invite people by creating a team), else null. */
export async function personalNoInvitesResponse(teamId: string | null | undefined): Promise<NextResponse | null> {
  const ws = await activeWorkspace(teamId);
  if (!ws || ws.kind !== 'personal') return null;
  return NextResponse.json(
    {
      success: false,
      error: { code: 'PERSONAL_WORKSPACE', message: 'Your personal workspace is just for you. Create a team to work with others.' },
    },
    { status: 403 }
  );
}
