/**
 * src/api/team/invite/decline/route.ts  (served at /api/invite/decline)
 *
 * POST { token } — Decline a project invitation. The secret token in the email link is the proof
 * of receipt, so no sign-in is needed. The inviter gets an in-app notification.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { effectiveInviteStatus, inviteStatusMessage, loadProjectInvite, notifyInviter } from '@/lib/projectInvites';

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  try {
    let body: { token?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Invalid JSON request payload');
    }
    const token = typeof body.token === 'string' ? body.token : '';
    const inv = await loadProjectInvite(token);
    if (!inv) return fail(404, 'NOT_FOUND', 'Invitation not found');

    const status = effectiveInviteStatus(inv);
    if (status !== 'pending') {
      return fail(status === 'expired' ? 410 : 409, status.toUpperCase(), inviteStatusMessage(status, inv.project.name));
    }

    const claimed = await prisma.projectInvitation.updateMany({
      where: { id: inv.id, status: 'pending' },
      data: { status: 'declined', respondedAt: new Date() },
    });
    if (claimed.count === 0) return fail(409, 'ALREADY_RESPONDED', 'This invitation has already been answered.');

    const existing = await prisma.user.findFirst({
      where: { email: { equals: inv.email, mode: 'insensitive' } },
      select: { name: true },
    });
    await notifyInviter(inv, 'declined', existing?.name || inv.email);

    return NextResponse.json({
      success: true,
      message: `You declined the invitation to ${inv.project.name}.`,
      data: { projectName: inv.project.name, inviterName: inv.invitedBy?.name || 'The project owner' },
    });
  } catch (error) {
    console.error('[POST /api/invite/decline] Error:', error);
    return fail(500, 'INTERNAL_ERROR', 'Failed to decline the invitation');
  }
}
