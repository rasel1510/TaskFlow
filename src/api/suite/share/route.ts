/**
 * src/api/suite/share/route.ts — public, read-only links.
 *
 *   GET    /api/suite/share?kind=&targetId=   the current link (if any)
 *   POST   /api/suite/share { kind, targetId } create or re-enable (new random token)
 *   DELETE /api/suite/share?kind=&targetId=   switch the link off
 *
 * Kinds: client_portal (a project, Customers module) · changelog / status (a product, Engineering).
 * Tokens are 32 random bytes; turning a link off and on again issues a new token.
 */
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { appBaseUrl } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const KINDS = { client_portal: 'customers', changelog: 'engineering', status: 'engineering' } as const;
type Kind = keyof typeof KINDS;

async function guard(kind: string | null, targetId: string | null) {
  if (!kind || !(kind in KINDS) || !targetId) return { error: fail(400, 'VALIDATION', 'Unknown link') } as const;
  const access = await requireSuite(KINDS[kind as Kind]);
  if (!access.ok) return { error: access.response } as const;
  const ctx = access.value;
  const target =
    kind === 'client_portal'
      ? await prisma.project.findFirst({ where: { id: targetId, teamId: ctx.teamId }, select: { id: true } })
      : await prisma.product.findFirst({ where: { id: targetId, teamId: ctx.teamId }, select: { id: true } });
  if (!target) return { error: fail(404, 'NOT_FOUND', 'Not found in this company') } as const;
  return { ctx, kind: kind as Kind, targetId } as const;
}

export async function GET(req: NextRequest) {
  const g = await guard(req.nextUrl.searchParams.get('kind'), req.nextUrl.searchParams.get('targetId'));
  if ('error' in g) return g.error;
  const link = await prisma.shareLink.findUnique({ where: { teamId_kind_targetId: { teamId: g.ctx.teamId, kind: g.kind, targetId: g.targetId } } });
  return ok(link?.enabled ? { url: `${appBaseUrl(req)}/p/${link.token}`, enabled: true } : { enabled: false });
}

export async function POST(req: NextRequest) {
  const body = z.object({ kind: z.string(), targetId: z.string().max(60) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, 'VALIDATION', 'Invalid request');
  const g = await guard(body.data.kind, body.data.targetId);
  if ('error' in g) return g.error;
  if (!g.ctx.isManager && g.kind !== 'client_portal') return fail(403, 'FORBIDDEN', 'Only Admins and Project Managers can publish public pages.');
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.shareLink.upsert({
    where: { teamId_kind_targetId: { teamId: g.ctx.teamId, kind: g.kind, targetId: g.targetId } },
    create: { teamId: g.ctx.teamId, kind: g.kind, targetId: g.targetId, token },
    update: { token, enabled: true },
  });
  await audit(g.ctx, 'share.enable', `${g.kind}:${g.targetId}`);
  return ok({ url: `${appBaseUrl(req)}/p/${token}`, enabled: true });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req.nextUrl.searchParams.get('kind'), req.nextUrl.searchParams.get('targetId'));
  if ('error' in g) return g.error;
  await prisma.shareLink.updateMany({ where: { teamId: g.ctx.teamId, kind: g.kind, targetId: g.targetId }, data: { enabled: false } });
  await audit(g.ctx, 'share.disable', `${g.kind}:${g.targetId}`);
  return ok({ enabled: false });
}
