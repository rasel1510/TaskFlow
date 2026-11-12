import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export async function POST(req: NextRequest) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized || !authCheck.user) {
    return authCheck.errorResponse;
  }

  try {
    const body = await req.json();
    const { targetTeamId } = body;

    const superAdminUserId = authCheck.user.id;

    // Find the primary FlowSync team
    const flowsyncTeam = await prisma.team.findFirst({
      where: { name: { equals: 'FlowSync', mode: 'insensitive' } },
    });

    if (!targetTeamId || targetTeamId === 'default' || targetTeamId === flowsyncTeam?.id) {
      // Revert to FlowSync company
      const updatedUser = await prisma.user.update({
        where: { id: superAdminUserId },
        data: { teamId: flowsyncTeam?.id || null },
        include: { team: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Active workspace returned to FlowSync platform headquarters',
        data: {
          currentTeam: updatedUser.team,
          isImpersonating: false,
        },
      });
    }

    // Verify target company exists
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
    });

    if (!targetTeam) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Target company not found' } },
        { status: 404 }
      );
    }

    // Switch workspace context
    const updatedUser = await prisma.user.update({
      where: { id: superAdminUserId },
      data: { teamId: targetTeam.id },
      include: { team: true },
    });

    return NextResponse.json({
      success: true,
      message: `Switched into ${targetTeam.name} workspace as FlowSync Super Admin`,
      data: {
        currentTeam: updatedUser.team,
        isImpersonating: true,
      },
    });
  } catch (error) {
    console.error('[Admin Impersonate Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to switch workspace context' } },
      { status: 500 }
    );
  }
}

