/**
 * src/api/suite/import/route.ts — POST /api/suite/import  { rows: [{ name, email, phone, companyName, jobTitle, source }] }
 *
 * Imports contacts (e.g. a CSV export from HubSpot or Excel). Up to 500 rows per request; every row is
 * validated; contacts whose email already exists in the company are skipped.
 */
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { ENTITIES } from '@/lib/suite/entities';

export const dynamic = 'force-dynamic';

const Body = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) });

export async function POST(req: Request) {
  const access = await requireSuite('sales');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'VALIDATION', 'Send between 1 and 500 rows.');

  const schema = ENTITIES.contacts.create.pick({ name: true, email: true, phone: true, companyName: true, jobTitle: true, source: true });
  const valid: Record<string, unknown>[] = [];
  let invalid = 0;
  for (const raw of parsed.data.rows) {
    const r = schema.safeParse({ ...raw, source: raw.source || 'other', email: raw.email || null, phone: raw.phone || null });
    if (r.success) valid.push(r.data);
    else invalid++;
  }

  const emails = valid.map(v => String(v.email || '').toLowerCase()).filter(Boolean);
  const existing = emails.length
    ? new Set((await prisma.contact.findMany({ where: { teamId: ctx.teamId, email: { in: emails, mode: 'insensitive' } }, select: { email: true } })).map(c => (c.email || '').toLowerCase()))
    : new Set<string>();
  const seen = new Set<string>();
  const fresh = valid.filter(v => {
    const e = String(v.email || '').toLowerCase();
    if (!e) return true;
    if (existing.has(e) || seen.has(e)) return false;
    seen.add(e);
    return true;
  });

  if (fresh.length) {
    await prisma.contact.createMany({ data: fresh.map(v => ({ ...v, teamId: ctx.teamId, ownerId: ctx.userId })) as never });
  }
  await audit(ctx, 'contacts.import', '', { imported: fresh.length, skipped: valid.length - fresh.length, invalid });
  return ok({ imported: fresh.length, duplicates: valid.length - fresh.length, invalid });
}
