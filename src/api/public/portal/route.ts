/**
 * src/api/public/portal/route.ts — POST /api/public/portal  { token, changeRequestId, decision }
 *
 * The client approves or declines an estimated change request from their portal link. Only works
 * with an enabled client_portal link, for a change request of that exact project, while it is
 * "estimated". Rate-limited per link.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { overLimit, HOUR } from '@/lib/abuseGuard';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  token: z.string().regex(/^[\w-]{20,80}$/),
  changeRequestId: z.string().min(1).max(60),
  decision: z.enum(['approved', 'rejected']),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 });
  const { token, changeRequestId, decision } = parsed.data;

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link?.enabled || link.kind !== 'client_portal') return NextResponse.json({ success: false }, { status: 404 });
  if (await overLimit('invite', `portal:${link.id}`, 60, HOUR)) return NextResponse.json({ success: false }, { status: 429 });

  const cr = await prisma.changeRequest.findFirst({ where: { id: changeRequestId, teamId: link.teamId, projectId: link.targetId } });
  if (!cr || cr.status !== 'estimated') return NextResponse.json({ success: false }, { status: 409 });

  await prisma.changeRequest.update({ where: { id: cr.id }, data: { status: decision, decidedAt: new Date() } });
  await prisma.auditLog.create({ data: { teamId: link.teamId, action: `portal.${decision}`, target: cr.id } }).catch(() => {});
  return NextResponse.json({ success: true });
}
