/**
 * src/api/workspaces/free-access/route.ts
 *
 * POST — ask the Super Admin for free use of my Personal workspace (no time limit once approved).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';
import { ensurePersonalWorkspace } from '@/lib/workspaces';

export async function POST() {
  const access = await requireUser();
  if (!access.ok) return access.response;
  try {
    const personal = await ensurePersonalWorkspace(access.value.id);
    if (personal.freeAccess === 'approved' || personal.freeAccess === 'requested') {
      return NextResponse.json({ success: true, data: { freeAccess: personal.freeAccess } });
    }
    await prisma.team.update({
      where: { id: personal.id },
      data: { freeAccess: 'requested', freeAccessRequestedAt: new Date(), freeAccessDecidedAt: null },
    });
    return NextResponse.json({ success: true, data: { freeAccess: 'requested' } });
  } catch (err) {
    console.error('[POST /api/workspaces/free-access]', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Couldn’t send your request. Please try again.' } },
      { status: 500 }
    );
  }
}
