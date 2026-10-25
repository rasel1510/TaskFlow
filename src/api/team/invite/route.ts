import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { sendTeamInviteEmail } from '@/lib/mail';

const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid work email address').toLowerCase().trim(),
  role: z.enum(['PROJECT_MANAGER', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

// ---------------------------------------------------------------------------
// GET /api/team/invite — List pending & recent team invitations
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const teamContext = await getOrProvisionUserTeam(userId);
    if (!teamContext) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEAM', message: 'No workspace found for your account' } },
        { status: 404 }
      );
    }

    const invites = await prisma.teamInvitation.findMany({
      where: {
        teamId: teamContext.teamId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        teamName: teamContext.teamName,
        teamId: teamContext.teamId,
        invites,
      },
    });
  } catch (error) {
    console.error('[GET /api/team/invite] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team invitations' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/team/invite — PM sends an email invitation
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const userRole = (session?.user as { role?: string })?.role;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Role check: Only Project Managers or Admins can invite team members
    const isPM =
      userRole === 'Project Manager' ||
      userRole === 'PROJECT_MANAGER' ||
      userRole?.toLowerCase() === 'project manager' ||
      userRole?.toLowerCase() === 'admin';

    if (!isPM) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Project Managers can invite members to the team' } },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } },
        { status: 422 }
      );
    }

    const { email, role } = parsed.data;

    // Resolve PM's team
    const teamContext = await getOrProvisionUserTeam(userId);
    if (!teamContext) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEAM', message: 'Failed to resolve team workspace' } },
        { status: 400 }
      );
    }

    // Check if the user is ALREADY an active member of this team
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        teamId: teamContext.teamId,
      },
      select: { id: true, name: true },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_MEMBER', message: `${email} is already an active member of ${teamContext.teamName}` } },
        { status: 409 }
      );
    }

    // Generate cryptographic token (32 bytes hex = 64 characters)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresInDays = 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Revoke any previous pending invitations for this email in this team
    await prisma.teamInvitation.updateMany({
      where: {
        teamId: teamContext.teamId,
        email,
        status: 'pending',
      },
      data: {
        status: 'revoked',
      },
    });

    // Create new invitation record
    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId: teamContext.teamId,
        email,
        role,
        token,
        status: 'pending',
        invitedById: userId,
        expiresAt,
      },
    });

    // Derive invitation acceptance URL
    const origin = req.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const inviteUrl = `${origin}/invite/accept?token=${token}`;

    // Dispatch email
    const mailResult = await sendTeamInviteEmail({
      to: email,
      inviterName: teamContext.userName || 'Project Manager',
      teamName: teamContext.teamName,
      inviteUrl,
      role: role === 'PROJECT_MANAGER' ? 'Project Manager' : role === 'VIEWER' ? 'Viewer' : 'Member',
      expiresInDays,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          inviteUrl,
          devMode: mailResult.devMode,
        },
        message: mailResult.devMode
          ? `Invitation generated (Dev Mode active). Share link: ${inviteUrl}`
          : `Invitation email dispatched to ${email}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/team/invite] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to dispatch team invitation' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/team/invite — Revoke invitation
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('id');
    if (!inviteId) {
      return NextResponse.json({ success: false, error: 'Invite ID required' }, { status: 400 });
    }

    const teamContext = await getOrProvisionUserTeam(userId);
    if (!teamContext) {
      return NextResponse.json({ success: false, error: 'No team found' }, { status: 404 });
    }

    await prisma.teamInvitation.deleteMany({
      where: {
        id: inviteId,
        teamId: teamContext.teamId,
      },
    });

    return NextResponse.json({ success: true, message: 'Invitation cancelled' });
  } catch (error) {
    console.error('[DELETE /api/team/invite] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to revoke invitation' }, { status: 500 });
  }
}
