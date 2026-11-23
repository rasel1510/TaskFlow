import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySuperAdmin } from '@/lib/superadmin';
import { normalizeDesignation, isSuperAdmin } from '@/lib/permissions';
import { purgeUser } from '@/lib/accountPurge';

export const dynamic = 'force-dynamic';

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
    const { role, plan, subscriptionStatus, teamId } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { team: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Safety rule: Primary super admin email cannot be demoted or deactivated
    if (existingUser.email === 'rasel4897981@gmail.com') {
      if (role && normalizeDesignation(role) !== 'Super Admin') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'The FlowSync primary Super Admin cannot be demoted.',
            },
          },
          { status: 403 }
        );
      }
      if (subscriptionStatus && subscriptionStatus !== 'active') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'The FlowSync primary Super Admin account cannot be suspended.',
            },
          },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, any> = {};

    if (role && typeof role === 'string') {
      updateData.role = normalizeDesignation(role);
    }

    if (plan && ['free', 'pro'].includes(plan.toLowerCase())) {
      updateData.plan = plan.toLowerCase();
    }

    if (subscriptionStatus && ['active', 'past_due', 'suspended'].includes(subscriptionStatus.toLowerCase())) {
      updateData.subscriptionStatus = subscriptionStatus.toLowerCase();
    }

    if (teamId !== undefined) {
      updateData.teamId = teamId || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        team: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} updated successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[Admin User PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } },
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
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { team: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Protection rule: Primary Super Admin and any Super Admin cannot be deleted
    if (
      existingUser.email === 'rasel4897981@gmail.com' ||
      isSuperAdmin({ email: existingUser.email, role: existingUser.role, teamName: existingUser.team?.name })
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Super Admin accounts cannot be deleted.',
          },
        },
        { status: 403 }
      );
    }

    // The person and all of their data are removed permanently in one transaction; projects they
    // own in a company that still exists are handed to its Admin. See src/lib/accountPurge.ts.
    const summary = await purgeUser(id);
    console.log(`[Admin User DELETE] ${existingUser.email}:`, summary);

    return NextResponse.json({
      success: true,
      message: `User "${existingUser.name}" (${existingUser.email}) and all associated data have been permanently deleted`,
    });
  } catch (error) {
    console.error('[Admin User DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' } },
      { status: 500 }
    );
  }
}

