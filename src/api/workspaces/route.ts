/**
 * src/api/workspaces/route.ts
 *
 * GET  /api/workspaces           — every workspace I belong to (Personal + companies) and the open one
 * POST /api/workspaces { id }    — open a workspace ('personal' or one of my companies)
 */
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/access';
import { listWorkspaces, switchWorkspace } from '@/lib/workspaces';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireUser();
  if (!access.ok) return access.response;
  try {
    const data = await listWorkspaces(access.value.id);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[GET /api/workspaces]', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Couldn’t load your workspaces.' } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireUser();
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const target = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
  if (!target) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Choose a workspace.' } }, { status: 400 });
  }
  try {
    const workspace = await switchWorkspace(access.value.id, target);
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'You don’t belong to that workspace.' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: workspace });
  } catch (err) {
    console.error('[POST /api/workspaces]', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Couldn’t switch workspace.' } },
      { status: 500 }
    );
  }
}
