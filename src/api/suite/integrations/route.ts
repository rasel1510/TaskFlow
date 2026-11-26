/**
 * src/api/suite/integrations/route.ts
 *
 *   GET    /api/suite/integrations              connection status (never tokens)
 *   POST   /api/suite/integrations              (Admins) { provider, secret, vercelTeamId? } verify + save encrypted
 *   DELETE /api/suite/integrations?provider=    (Admins) disconnect
 *   PUT    /api/suite/integrations              (Admins) { provider } sync now (github | vercel)
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { PROVIDERS, sealForStorage, syncGithub, syncVercel, verifyAndDescribe, type Provider } from '@/lib/suite/integrations';
import { appBaseUrl } from '@/lib/billing';
import { overLimit, HOUR } from '@/lib/abuseGuard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const rows = await prisma.integration.findMany({
    where: { teamId: ctx.teamId },
    select: { provider: true, status: true, accountLabel: true, lastSyncAt: true, lastError: true, createdAt: true },
  });
  return ok({
    connections: rows,
    canManage: ctx.isAdmin,
    githubWebhookUrl: `${appBaseUrl(req)}/api/webhooks/github?team=${ctx.teamId}`,
  });
}

const ConnectSchema = z.object({
  provider: z.enum(PROVIDERS),
  secret: z.string().trim().min(8).max(2000),
  vercelTeamId: z.string().trim().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const access = await requireSuite('engineering', { adminOnly: true });
  if (!access.ok) return access.response;
  const ctx = access.value;
  if (await overLimit('invite', `integration:${ctx.teamId}`, 30, HOUR)) return fail(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');

  const parsed = ConnectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'VALIDATION', 'Paste the full token or webhook URL.');
  const { provider, secret, vercelTeamId } = parsed.data;

  let described;
  try {
    described = await verifyAndDescribe(provider as Provider, secret, { vercelTeamId });
  } catch (e) {
    return fail(400, 'VERIFY_FAILED', (e as Error).message);
  }
  const sealed = sealForStorage(secret, described.webhookSecret);
  await prisma.integration.upsert({
    where: { teamId_provider: { teamId: ctx.teamId, provider } },
    create: { teamId: ctx.teamId, provider, accountLabel: described.accountLabel, config: (described.config ?? {}) as object, connectedById: ctx.userId, ...sealed },
    update: { status: 'connected', accountLabel: described.accountLabel, config: (described.config ?? {}) as object, lastError: null, connectedById: ctx.userId, ...sealed },
  });
  await audit(ctx, 'integration.connect', provider);
  // The GitHub webhook secret is shown once, so the Admin can paste it into GitHub
  return ok({ provider, accountLabel: described.accountLabel, ...(described.webhookSecret ? { webhookSecret: described.webhookSecret } : {}) });
}

export async function DELETE(req: NextRequest) {
  const access = await requireSuite('engineering', { adminOnly: true });
  if (!access.ok) return access.response;
  const ctx = access.value;
  const provider = req.nextUrl.searchParams.get('provider');
  if (!provider || !(PROVIDERS as readonly string[]).includes(provider)) return fail(400, 'VALIDATION', 'Unknown provider');
  await prisma.integration.deleteMany({ where: { teamId: ctx.teamId, provider } });
  await audit(ctx, 'integration.disconnect', provider);
  return ok({ provider });
}

export async function PUT(req: NextRequest) {
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const body = (await req.json().catch(() => null)) as { provider?: string } | null;
  const provider = body?.provider;
  if (provider !== 'github' && provider !== 'vercel') return fail(400, 'VALIDATION', 'Only GitHub and Vercel can be synced.');

  // At most once a minute per company and provider
  const row = await prisma.integration.findUnique({ where: { teamId_provider: { teamId: ctx.teamId, provider } }, select: { lastSyncAt: true } });
  if (!row) return fail(404, 'NOT_CONNECTED', `${provider === 'github' ? 'GitHub' : 'Vercel'} is not connected.`);
  if (row.lastSyncAt && Date.now() - row.lastSyncAt.getTime() < 60_000) return ok({ skipped: true, lastSyncAt: row.lastSyncAt });

  try {
    const result = provider === 'github' ? await syncGithub(ctx.teamId, ctx.settings) : await syncVercel(ctx.teamId);
    await audit(ctx, `integration.sync`, provider, result as Record<string, unknown>);
    return ok(result);
  } catch (e) {
    return fail(502, 'SYNC_FAILED', (e as Error).message);
  }
}
