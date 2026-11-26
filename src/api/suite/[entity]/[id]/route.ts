/**
 * src/api/suite/[entity]/[id]/route.ts — read, edit and delete one suite record (company-scoped).
 */
import { NextRequest } from 'next/server';
import { ENTITIES } from '@/lib/suite/entities';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { delegate, checkLinks, cleanInput, canDelete } from '@/lib/suite/records';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string; id: string }> };

async function load(entity: string, id: string) {
  const def = ENTITIES[entity];
  if (!def) return { error: fail(404, 'NOT_FOUND', 'Unknown record type') } as const;
  const access = await requireSuite(def.module);
  if (!access.ok) return { error: access.response } as const;
  const ctx = access.value;
  const record = await delegate(def.model).findFirst({ where: { id, teamId: ctx.teamId } });
  if (!record) return { error: fail(404, 'NOT_FOUND', `${def.label} not found`) } as const;
  return { def, ctx, record } as const;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { entity, id } = await params;
  const r = await load(entity, id);
  if ('error' in r) return r.error;
  return ok(r.record);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { entity, id } = await params;
  const r = await load(entity, id);
  if ('error' in r) return r.error;
  const { def, ctx } = r;
  if (def.readOnly) return fail(405, 'READ_ONLY', `${def.label}s are updated automatically.`);

  const body = await req.json().catch(() => null);
  const parsed = def.create.partial().safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'VALIDATION', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input');
  }
  const data = cleanInput(parsed.data);
  if (Object.keys(data).length === 0) return ok(r.record);
  const linkError = await checkLinks(def, data, ctx.teamId);
  if (linkError) return fail(400, 'BAD_LINK', linkError);

  try {
    const updated = await delegate(def.model).update({ where: { id }, data });
    await audit(ctx, `${entity}.update`, id, { fields: Object.keys(data) });
    return ok(updated);
  } catch (err) {
    console.error(`[PATCH /api/suite/${entity}]`, err);
    return fail(500, 'SAVE_FAILED', `Could not update the ${def.label.toLowerCase()}.`);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { entity, id } = await params;
  const r = await load(entity, id);
  if ('error' in r) return r.error;
  const { def, ctx, record } = r;
  if (def.readOnly) return fail(405, 'READ_ONLY', `${def.label}s are removed automatically.`);
  if (!canDelete(def, record, ctx.userId, ctx.isManager)) {
    return fail(403, 'FORBIDDEN', `Only its owner or a company Admin / Project Manager can delete this ${def.label.toLowerCase()}.`);
  }
  try {
    await delegate(def.model).delete({ where: { id } });
    await audit(ctx, `${entity}.delete`, id);
    return ok({ id });
  } catch (err) {
    console.error(`[DELETE /api/suite/${entity}]`, err);
    return fail(500, 'DELETE_FAILED', `Could not delete the ${def.label.toLowerCase()}.`);
  }
}
