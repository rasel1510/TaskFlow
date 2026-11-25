/**
 * src/api/admin/free-access/route.ts  (Super Admin only)
 *
 * GET   — personal workspaces asking for free use (pending first, then recent decisions)
 * PATCH { teamId, decision: 'approve' | 'decline' | 'revoke' } — decide; the person is notified
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) return authCheck.errorResponse;

  const rows = await prisma.team.findMany({
    where: { kind: 'personal', freeAccess: { in: ['requested', 'approved', 'declined'] } },
    orderBy: [{ freeAccessRequestedAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      freeAccess: true,
      freeAccessRequestedAt: true,
      freeAccessDecidedAt: true,
      trialEndsAt: true,
      personalOwnerId: true,
      _count: { select: { projects: true } },
    },
  });
  const ownerIds = rows.map(r => r.personalOwnerId).filter((v): v is string => Boolean(v));
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true, email: true, avatar: true },
  });
  const byId = new Map(owners.map(o => [o.id, o]));
  const data = rows
    .map(r => ({
      teamId: r.id,
      status: r.freeAccess,
      requestedAt: r.freeAccessRequestedAt?.toISOString() ?? null,
      decidedAt: r.freeAccessDecidedAt?.toISOString() ?? null,
      trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
      projects: r._count.projects,
      user: r.personalOwnerId ? byId.get(r.personalOwnerId) ?? null : null,
    }))
    .filter(r => r.user)
    .sort((a, b) => Number(b.status === 'requested') - Number(a.status === 'requested'));

  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(req: Request) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) return authCheck.errorResponse;

  const body = (await req.json().catch(() => ({}))) as { teamId?: unknown; decision?: unknown };
  const teamId = typeof body.teamId === 'string' ? body.teamId : '';
  const decision = String(body.decision ?? '');
  if (!teamId || !['approve', 'decline', 'revoke'].includes(decision)) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Choose approve, decline or revoke.' } },
      { status: 400 }
    );
  }
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { kind: true, personalOwnerId: true } });
  if (!team || team.kind !== 'personal' || !team.personalOwnerId) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found.' } }, { status: 404 });
  }

  const status = decision === 'approve' ? 'approved' : decision === 'decline' ? 'declined' : 'none';
  await prisma.team.update({ where: { id: teamId }, data: { freeAccess: status, freeAccessDecidedAt: new Date() } });

  // Let the person know (always delivered — it answers their own request)
  const message =
    status === 'approved'
      ? { title: 'Free use approved', body: 'Your personal workspace is now free to use, with no time limit.' }
      : status === 'declined'
        ? { title: 'Free use not approved', body: 'Your free-use request wasn’t approved. Create a team to keep working.' }
        : { title: 'Free use ended', body: 'Free use of your personal workspace has ended.' };
  await prisma.notification.create({ data: { userId: team.personalOwnerId, type: 'free_access', ...message } }).catch(() => {});

  return NextResponse.json({ success: true, data: { teamId, status } });
}
