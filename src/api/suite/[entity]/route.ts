/**
 * src/api/suite/[entity]/route.ts — list and create records of the Software Company suite.
 *
 *   GET  /api/suite/<entity>?q=&<filter>=&cursor=&limit=   (company-scoped, max 100 per page)
 *   POST /api/suite/<entity>                               (validated, linked records checked)
 *
 * The record types and their rules live in src/lib/suite/entities.ts.
 */
import { NextRequest } from 'next/server';
import { ENTITIES } from '@/lib/suite/entities';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { delegate, checkLinks, cleanInput } from '@/lib/suite/records';
import { afterCreate } from '@/lib/suite/hooks';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ entity: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { entity } = await params;
  const def = ENTITIES[entity];
  if (!def) return fail(404, 'NOT_FOUND', 'Unknown record type');
  const access = await requireSuite(def.module);
  if (!access.ok) return access.response;
  const ctx = access.value;

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 50, 1), 100);
  const cursor = sp.get('cursor') || undefined;
  const q = (sp.get('q') || '').trim().slice(0, 100);

  const where: Record<string, unknown> = { teamId: ctx.teamId };
  for (const f of def.filters || []) {
    const v = sp.get(f);
    if (v === null) continue;
    where[f] = v === 'none' ? null : v;
  }
  if (q && def.search?.length) {
    where.OR = def.search.map(field => ({ [field]: { contains: q, mode: 'insensitive' } }));
  }

  try {
    const rows = await delegate(def.model).findMany({
      where,
      orderBy: [def.order, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return ok(items, { hasMore, nextCursor: hasMore ? items[items.length - 1].id : null, limit });
  } catch (err) {
    console.error(`[GET /api/suite/${entity}]`, err);
    return fail(500, 'LOAD_FAILED', 'Could not load records. Please try again.');
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { entity } = await params;
  const def = ENTITIES[entity];
  if (!def) return fail(404, 'NOT_FOUND', 'Unknown record type');
  if (def.readOnly) return fail(405, 'READ_ONLY', `${def.label}s are added automatically.`);
  const access = await requireSuite(def.module);
  if (!access.ok) return access.response;
  const ctx = access.value;

  const body = await req.json().catch(() => null);
  const parsed = def.create.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'VALIDATION', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input');
  }
  const data = cleanInput(parsed.data);
  const linkError = await checkLinks(def, data, ctx.teamId);
  if (linkError) return fail(400, 'BAD_LINK', linkError);

  if (def.creatorField) data[def.creatorField] = ctx.userId;
  def.prepare?.(data);
  // New records are owned by their creator unless someone else was chosen
  for (const f of ['ownerId', 'managerId'] as const) {
    if (f in def.create.shape && data[f] === undefined) data[f] = ctx.userId;
  }

  try {
    const created = await delegate(def.model).create({ data: { ...data, teamId: ctx.teamId } });
    await audit(ctx, `${entity}.create`, String(created.id));
    await afterCreate(entity, created, ctx);
    return ok(created);
  } catch (err) {
    console.error(`[POST /api/suite/${entity}]`, err);
    return fail(500, 'SAVE_FAILED', `Could not save the ${def.label.toLowerCase()}. Please try again.`);
  }
}
