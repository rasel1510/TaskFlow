/**
 * src/api/suite/context/route.ts
 *
 *   GET   /api/suite/context  → is the software suite on for the open company, my department, the
 *                                modules I can use, company settings and the member directory
 *   PATCH /api/suite/context  → (Admins) switch the suite on/off, change automation settings
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';
import { fail, ok, audit, DEFAULT_SETTINGS, type SuiteSettings } from '@/lib/suite/server';
import {
  SUITE_MODULES,
  canUseModule,
  effectiveDepartment,
  insightSections,
  isCompanyManager,
} from '@/lib/suite/departments';

export const dynamic = 'force-dynamic';

async function openCompany(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
  if (!me?.teamId) return null;
  const [team, membership] = await Promise.all([
    prisma.team.findUnique({
      where: { id: me.teamId },
      select: { id: true, name: true, kind: true, workspaceType: true, industry: true, suiteSettings: true },
    }),
    prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId: me.teamId, userId } },
      select: { role: true, department: true, jobTitle: true },
    }),
  ]);
  return team ? { team, membership } : null;
}

export async function GET() {
  const access = await requireUser();
  if (!access.ok) return access.response;
  const user = access.value;

  const open = await openCompany(user.id);
  if (!open || open.team.kind !== 'company') return ok({ enabled: false, canEnable: false });

  const role = user.isSuperAdmin ? 'Admin' : open.membership?.role || 'Member';
  const isAdmin = role === 'Admin' || user.isSuperAdmin;
  if (open.team.workspaceType !== 'software') {
    return ok({ enabled: false, canEnable: isAdmin, teamName: open.team.name });
  }

  const department = effectiveDepartment(open.membership?.department);
  const projects = await prisma.project.findMany({
    where: { teamId: open.team.id, archivedAt: null },
    select: { id: true, name: true, color: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId: open.team.id },
    select: {
      role: true,
      department: true,
      jobTitle: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  return ok({
    enabled: true,
    canEnable: isAdmin,
    teamId: open.team.id,
    teamName: open.team.name,
    me: { id: user.id, role, department, jobTitle: open.membership?.jobTitle || '', isAdmin, isManager: isCompanyManager(role) },
    modules: SUITE_MODULES.filter(m => canUseModule(m, department, role)),
    insights: insightSections(department, role),
    settings: { ...DEFAULT_SETTINGS, ...((open.team.suiteSettings as SuiteSettings | null) || {}) },
    projects,
    members: memberships.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
      department: effectiveDepartment(m.department),
      departmentSet: Boolean(m.department),
      jobTitle: m.jobTitle || '',
    })),
  });
}

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z
    .object({
      autoReviewOnPrOpen: z.boolean(),
      autoDoneOnPrMerge: z.boolean(),
      launchChecklistOnRelease: z.boolean(),
      projectOnDealWon: z.boolean(),
      notifyOnCallForSev1: z.boolean(),
    })
    .partial()
    .optional(),
});

export async function PATCH(req: Request) {
  const access = await requireUser();
  if (!access.ok) return access.response;
  const user = access.value;

  const open = await openCompany(user.id);
  if (!open || open.team.kind !== 'company') return fail(404, 'NO_COMPANY', 'Open a company first.');
  const isAdmin = open.membership?.role === 'Admin' || user.isSuperAdmin;
  if (!isAdmin) return fail(403, 'ADMIN_ONLY', 'Only company Admins can change this.');

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'VALIDATION', 'Invalid settings');
  const { enabled, settings } = parsed.data;

  const data: Record<string, unknown> = {};
  if (enabled !== undefined) data.workspaceType = enabled ? 'software' : 'general';
  if (settings) data.suiteSettings = { ...((open.team.suiteSettings as SuiteSettings | null) || {}), ...settings };
  if (Object.keys(data).length === 0) return ok({ updated: false });

  await prisma.team.update({ where: { id: open.team.id }, data });
  await audit({ teamId: open.team.id, userId: user.id }, enabled !== undefined ? `suite.${enabled ? 'enable' : 'disable'}` : 'suite.settings');
  return ok({ updated: true });
}
