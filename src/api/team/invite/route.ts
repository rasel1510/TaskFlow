import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { sendTeamInviteEmail } from '@/lib/mail';
import { getAppOrigin } from '@/lib/origin';

const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid work email address').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER']).default('MEMBER'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
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

    // Role check: Only Admins or Project Managers can invite team members
    const isAdmin =
      userRole === 'Admin' ||
      userRole === 'ADMIN' ||
      userRole?.toLowerCase() === 'admin';
    const isPM =
      userRole === 'Project Manager' ||
      userRole === 'PROJECT_MANAGER' ||
      userRole?.toLowerCase() === 'project manager';

    if (!isAdmin && !isPM) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Admins and Project Managers can invite members to the team' } },
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

    const { email, role, password: inputPassword } = parsed.data;

    // Resolve given password or auto-generate secure temporary password
    const givenPassword = inputPassword?.trim() || `FlowSync@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(givenPassword, 10);

    // PM can only invite standard members, not PMs or Admins
    if (!isAdmin && (role === 'PROJECT_MANAGER' || role === 'ADMIN')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only Team Administrators can invite Project Managers or Admins' } },
        { status: 403 }
      );
    }

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

    // Pre-provision user or update password so credentials work across signup, accept & direct login
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const assignedRole =
      role === 'ADMIN' ? 'Admin' : role === 'PROJECT_MANAGER' ? 'Project Manager' : 'User';

    if (!existingUser) {
      const initials = email.substring(0, 2).toUpperCase();
      await prisma.user.create({
        data: {
          name: email.split('@')[0],
          email,
          password: hashedPassword,
          role: assignedRole,
          avatar: initials,
          teamId: teamContext.teamId,
          emailVerified: null, // marked as pending until signup or acceptance
        },
      });
    } else if (!existingUser.teamId) {
      // User account exists without team — associate team and set password
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          teamId: teamContext.teamId,
          role: assignedRole,
        },
      });
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

    // Derive invitation acceptance URL (accurately resolved for tunnels, LAN IPs, and Vercel)
    const origin = getAppOrigin(req);
    const inviteUrl = `${origin}/invite/accept?token=${token}`;

    // Dispatch email with Company Name and Given Password
    const mailResult = await sendTeamInviteEmail({
      to: email,
      inviterName: teamContext.userName || (isAdmin ? 'Team Administrator' : 'Project Manager'),
      teamName: teamContext.teamName,
      inviteUrl,
      role: role === 'ADMIN' ? 'Admin' : role === 'PROJECT_MANAGER' ? 'Project Manager' : role === 'VIEWER' ? 'Viewer' : 'Member',
      password: givenPassword,
      expiresInDays,
    });

    if (!mailResult.success && !mailResult.devMode) {
      console.error('[POST /api/team/invite] Email dispatch failed:', mailResult.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_DISPATCH_FAILED',
            message: `Invitation created in database, but email failed to send: ${mailResult.error || 'SMTP delivery failed'}. Please configure SMTP environment variables in Vercel.`,
          },
          data: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt.toISOString(),
            inviteUrl,
            companyName: teamContext.teamName,
            givenPassword,
          },
        },
        { status: 502 }
      );
    }

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
          companyName: teamContext.teamName,
          givenPassword,
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
