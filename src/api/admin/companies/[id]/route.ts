import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, projects: true, invitations: true },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            plan: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
        projects: {
          include: {
            _count: { select: { tasks: true, members: true } },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    console.error('[Admin Company GET Detail Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve company details' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, plan, status } = body;

    const existingTeam = await prisma.team.findUnique({ where: { id } });
    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    // 1. Update company name if provided
    let updatedTeam = existingTeam;
    if (name && typeof name === 'string' && name.trim()) {
      updatedTeam = await prisma.team.update({
        where: { id },
        data: { name: name.trim() },
      });
    }

    // 2. Cascade plan change to all company members
    if (plan && ['free', 'pro', 'enterprise'].includes(plan.toLowerCase())) {
      await prisma.user.updateMany({
        where: { teamId: id },
        data: { plan: plan.toLowerCase() },
      });
    }

    // 3. Cascade subscription status change to all company members
    if (status && ['active', 'past_due', 'suspended'].includes(status.toLowerCase())) {
      await prisma.user.updateMany({
        where: { teamId: id },
        data: { subscriptionStatus: status.toLowerCase() },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Company "${updatedTeam.name}" updated successfully`,
      data: updatedTeam,
    });
  } catch (error) {
    console.error('[Admin Company PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update company' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.authorized) {
    return authCheck.errorResponse;
  }

  const { id } = await params;

  try {
    const existingTeam = await prisma.team.findUnique({ where: { id } });
    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 }
      );
    }

    // Protection rule: FlowSync platform owner company can never be deleted
    if (existingTeam.name.toLowerCase().trim() === 'flowsync') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'The FlowSync software owner organization cannot be deleted.',
          },
        },
        { status: 403 }
      );
    }

    // Dissolve team association for users
    await prisma.user.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    });

    // Delete team
    await prisma.team.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Company "${existingTeam.name}" has been deleted from the platform`,
    });
  } catch (error) {
    console.error('[Admin Company DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete company' } },
      { status: 500 }
    );
  }
}

