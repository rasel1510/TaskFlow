/**
 * src/api/suite/work/[id]/route.ts — edit or delete one work item of the open software company.
 */
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { WorkInput, WORK_SELECT, checkWorkLinks } from '@/api/suite/work/route';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;

  const existing = await prisma.task.findFirst({ where: { id, project: { teamId: ctx.teamId } }, select: { id: true, status: true, completedAt: true } });
  if (!existing) return fail(404, 'NOT_FOUND', 'Work item not found');

  const parsed = WorkInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'VALIDATION', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input');
  }
  const d = parsed.data;
  if (d.parentId === id) return fail(400, 'BAD_LINK', 'An item cannot be its own parent.');
  const linkError = await checkWorkLinks(ctx.teamId, d);
  if (linkError) return fail(400, 'BAD_LINK', linkError);

  const data: Record<string, unknown> = { ...d };
  if (d.bugDetails === null) data.bugDetails = undefined;
  if (d.status && d.status !== existing.status) {
    data.completedAt = d.status === 'done' ? existing.completedAt ?? new Date() : null;
  }

  try {
    const updated = await prisma.task.update({ where: { id }, data, select: WORK_SELECT });
    await audit(ctx, 'work.update', id, { fields: Object.keys(d) });
    return ok(updated);
  } catch (err) {
    console.error('[PATCH /api/suite/work/:id]', err);
    return fail(500, 'SAVE_FAILED', 'Could not update the work item.');
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;

  const existing = await prisma.task.findFirst({ where: { id, project: { teamId: ctx.teamId } }, select: { id: true, creatorId: true } });
  if (!existing) return fail(404, 'NOT_FOUND', 'Work item not found');
  if (!ctx.isManager && existing.creatorId !== ctx.userId) {
    return fail(403, 'FORBIDDEN', 'Only its creator or a company Admin / Project Manager can delete this item.');
  }
  await prisma.task.delete({ where: { id } });
  await audit(ctx, 'work.delete', id);
  return ok({ id });
}
