/**
 * src/api/webhooks/github/route.ts — POST /api/webhooks/github?team=<companyId>
 *
 * Receives GitHub "pull_request" events for a software company. Accepted only with a valid
 * X-Hub-Signature-256 made with that company's webhook secret (shown once when GitHub is connected).
 */
import { NextRequest, NextResponse } from 'next/server';
import { handleGithubWebhook } from '@/lib/suite/integrations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const teamId = req.nextUrl.searchParams.get('team') || '';
  if (!/^[\w-]{10,40}$/.test(teamId)) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 2_000_000) return NextResponse.json({ ok: false }, { status: 413 });
  try {
    const result = await handleGithubWebhook(teamId, raw, req.headers.get('x-hub-signature-256'), req.headers.get('x-github-event'));
    if (result === 'unauthorized') return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[webhooks/github]', (err as Error)?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
