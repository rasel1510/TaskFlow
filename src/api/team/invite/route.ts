import redisCache from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { sendTeamInviteEmail } from '@/lib/mail';
import { getAppOrigin } from '@/lib/origin';
import { inTeam, personalNoInvitesResponse } from '@/lib/workspaces';
import { toCompanyRole } from '@/lib/companyRoles';
import { overLimit, HOUR } from '@/lib/abuseGuard';

/** Only Admins and Project Managers of the open company manage invitations and see their secrets. */
const managesInvites = (role: string | null | undefined, isPlatformOwner?: boolean) =>
  Boolean(isPlatformOwner) || ['Admin', 'Project Manager'].includes(toCompanyRole(role));

const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid work email address').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'PROJECT_MANAGER', 'MEMBER']).default('MEMBER'),
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
        initialPassword: true,
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

    // Invite links and starting passwords are credentials — only Admins / Project Managers see them
    const canSeeSecrets = managesInvites(teamContext.userRole, (session.user as { isSuperAdmin?: boolean })?.isSuperAdmin);
    return NextResponse.json({
      success: true,
      data: {
        teamName: teamContext.teamName,
        teamId: teamContext.teamId,
        invites: canSeeSecrets ? invites : invites.map(i => ({ ...i, token: '', initialPassword: null })),
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

    // Invitation emails are limited per sender (stops using FlowSync to spam addresses)
    if (await overLimit('invite', userId, 50, HOUR)) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many invitations sent. Please try again in an hour.' } },
        { status: 429 }
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
    // A generated starting password must not be guessable (was only 9,000 possibilities)
    const givenPassword = inputPassword?.trim() || `Fs-${crypto.randomBytes(9).toString('base64url')}7a`;
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

    // A personal workspace is just for its owner
    const personalBlock = await personalNoInvitesResponse(teamContext.teamId);
    if (personalBlock) return personalBlock;

    // Check if the user is ALREADY an active member of this team
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        ...inTeam(teamContext.teamId),
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
      role === 'ADMIN' ? 'Admin' : role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member';

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
    }
    // Existing accounts are never modified here (no password reset, no silent team change):
    // they join the team only when they accept the invitation with their own credentials.

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
        initialPassword: givenPassword,
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
      role: role === 'ADMIN' ? 'Admin' : role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member',
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

    redisCache.delPattern('team:*').catch(() => {});
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

    if (!managesInvites(teamContext.userRole, (session.user as { isSuperAdmin?: boolean })?.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Only Admins or Project Managers can cancel invitations' }, { status: 403 });
    }

    redisCache.delPattern('team:*').catch(() => {});
    const invite = await prisma.teamInvitation.findFirst({
      where: { id: inviteId, teamId: teamContext.teamId },
      select: { email: true, status: true },
    });
    await prisma.teamInvitation.deleteMany({
      where: {
        id: inviteId,
        teamId: teamContext.teamId,
      },
    });
    // Remove the placeholder account the invitation created, if it was never used
    if (invite && invite.status === 'pending') {
      await prisma.user
        .deleteMany({
          where: {
            email: invite.email.toLowerCase(),
            emailVerified: null,
            workspaceMemberships: { none: {} },
            projectsOwned: { none: {} },
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Invitation cancelled' });
  } catch (error) {
    console.error('[DELETE /api/team/invite] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to revoke invitation' }, { status: 500 });
  }
}
