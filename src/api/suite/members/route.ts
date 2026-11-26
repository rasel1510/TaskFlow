/**
 * src/api/suite/members/route.ts
 *
 *   PATCH /api/suite/members  { userId, department?, jobTitle? }
 *
 * Admins and Project Managers set anyone's department and job title; everyone may set their own job
 * title. Departments decide which modules a person sees, so only managers can change them.
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { DEPARTMENTS } from '@/lib/suite/departments';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  userId: z.string().trim().min(1).max(60),
  department: z.enum(DEPARTMENTS).optional(),
  jobTitle: z.string().trim().max(80).optional(),
});

export async function PATCH(req: Request) {
  const access = await requireSuite();
  if (!access.ok) return access.response;
  const ctx = access.value;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'VALIDATION', 'Choose a valid department and job title.');
  const { userId, department, jobTitle } = parsed.data;

  const self = userId === ctx.userId;
  if (!ctx.isManager && (!self || department !== undefined)) {
    return fail(403, 'FORBIDDEN', 'Only Admins and Project Managers can change departments.');
  }

  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId: ctx.teamId, userId } },
    select: { id: true },
  });
  if (!membership) return fail(404, 'NOT_FOUND', 'This person is not a member of the company.');

  await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { ...(department !== undefined ? { department } : {}), ...(jobTitle !== undefined ? { jobTitle } : {}) },
  });
  await audit(ctx, 'member.update', userId, { department, jobTitle });
  return ok({ userId, department, jobTitle });
}
