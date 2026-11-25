/**
 * src/api/team/invite/accept/route.ts  (also served at /api/invite/accept)
 *
 * GET  ?token=...  — Describe an invitation (project or team) for the acceptance page
 * POST { token, name?, password? } — Accept it
 *
 * Project invitations:
 *  - Signed-in user: must be the invited email.
 *  - Signed out, existing account with a password: must confirm that password.
 *  - Signed out, existing Google-only account: must sign in with Google first.
 *  - Signed out, no account: creates one from { name, password } (email is proven by the token).
 *  Acceptance, membership and account creation run in one transaction, so a link can't be used twice.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { getSessionUser } from '@/lib/access';
import { joinCompany, toCompanyRole } from '@/lib/companyMembership';
import { addMembership, switchWorkspace } from '@/lib/workspaces';
import {
  effectiveInviteStatus,
  initialsFor,
  inviteStatusMessage,
  loadProjectInvite,
  notifyInviter,
  validateNewPassword,
} from '@/lib/projectInvites';

const AcceptInviteSchema = z.object({
  token: z.string().min(10, 'Valid token is required'),
  name: z.string().trim().max(80, 'Name must be 80 characters or fewer').optional(),
  password: z.string().max(128).optional(),
});

const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ success: false, error: { code, message, ...extra } }, { status });

/**
 * The signed-in user, but only if their account still exists. A browser can keep a session for an
 * account that was deleted; treating that as signed in would make acceptance fail.
 */
async function currentUser() {
  const session = await getSessionUser();
  if (!session) return null;
  const exists = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } });
  return exists ? session : null;
}

/** Find a user by email regardless of letter case (older rows may not be lower-cased). */
function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, password: true, teamId: true, emailVerified: true },
  });
}

class InviteAlreadyUsedError extends Error {}

// ---------------------------------------------------------------------------
// GET — invitation details
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token') || '';
    if (!token) return fail(400, 'INVALID_TOKEN', 'Invitation token is missing');

    // 1. Project invitation
    const inv = await loadProjectInvite(token);
    if (inv) {
      const status = effectiveInviteStatus(inv);
      if (status === 'expired' && inv.status === 'pending') {
        await prisma.projectInvitation.update({ where: { id: inv.id }, data: { status: 'expired' } }).catch(() => {});
      }

      const existing = await findUserByEmail(inv.email);
      const session = await currentUser();
      const alreadyMember = existing
        ? Boolean(
            await prisma.projectMember.findUnique({
              where: { projectId_userId: { projectId: inv.projectId, userId: existing.id } },
              select: { id: true },
            })
          )
        : false;

      return NextResponse.json({
        success: true,
        data: {
          type: 'project',
          status,
          statusMessage: status === 'pending' ? null : inviteStatusMessage(status, inv.project.name),
          email: inv.email,
          role: toCompanyRole(inv.role),
          projectId: inv.project.id,
          projectName: inv.project.name,
          projectColor: inv.project.color || '#2563EB',
          organizationName: inv.project.team?.name ?? null,
          inviterName: inv.invitedBy?.name || 'A teammate',
          inviterEmail: inv.invitedBy?.email || null,
          expiresAt: inv.expiresAt.toISOString(),
          // 'none' → create an account; 'password' → confirm password; 'google' → sign in with Google first
          account: !existing ? 'none' : existing.password ? 'password' : 'google',
          userExists: Boolean(existing),
          alreadyInTeam: alreadyMember,
          signedInEmail: session?.email || null,
          signedInMatches: Boolean(session && session.email === inv.email.toLowerCase()),
        },
      });
    }

    // 2. Team invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { team: { select: { id: true, name: true } }, invitedBy: { select: { name: true } } },
    });
    if (!invitation) return fail(404, 'NOT_FOUND', 'Invitation not found or link has expired');
    if (invitation.status !== 'pending') {
      return fail(400, 'ALREADY_USED', `This invitation is already ${invitation.status}`);
    }
    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
      return fail(410, 'EXPIRED', 'This invitation has expired. Please ask for a new one.');
    }
    const existingUser = await findUserByEmail(invitation.email);
    return NextResponse.json({
      success: true,
      data: {
        type: 'team',
        status: 'pending',
        token: invitation.token,
        email: invitation.email,
        role: invitation.role,
        teamName: invitation.team.name,
        teamId: invitation.team.id,
        inviterName: invitation.invitedBy?.name || 'Your administrator',
        userExists: Boolean(existingUser),
        alreadyInTeam: existingUser?.teamId === invitation.team.id,
      },
    });
  } catch (error) {
    console.error('[GET /api/invite/accept] Error:', error);
    return fail(500, 'INTERNAL_ERROR', 'Failed to verify invitation');
  }
}

// ---------------------------------------------------------------------------
// POST — accept
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Invalid JSON request payload');
    }
    const parsed = AcceptInviteSchema.safeParse(body);
    if (!parsed.success) return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid request');
    const { token, name, password } = parsed.data;

    const inv = await loadProjectInvite(token);
    if (inv) return await acceptProjectInvite(inv, name, password);
    return await acceptTeamInvite(token, name, password);
  } catch (error) {
    console.error('[POST /api/invite/accept] Error:', error);
    return fail(500, 'INTERNAL_ERROR', 'Something went wrong while accepting the invitation. Please try again.');
  }
}

async function acceptProjectInvite(
  inv: NonNullable<Awaited<ReturnType<typeof loadProjectInvite>>>,
  name: string | undefined,
  password: string | undefined
) {
  const status = effectiveInviteStatus(inv);
  if (status !== 'pending') {
    return fail(status === 'expired' ? 410 : 409, status.toUpperCase(), inviteStatusMessage(status, inv.project.name));
  }

  const inviteEmail = inv.email.toLowerCase();
  const session = await currentUser();

  // Decide who is accepting (and verify it is really the invited person)
  let existingUserId: string | null = null;
  let newAccount: { name: string; passwordHash: string } | null = null;
  let actorName = '';

  if (session) {
    if (session.email !== inviteEmail) {
      return fail(
        403,
        'EMAIL_MISMATCH',
        `This invitation was sent to ${inv.email}, but you're signed in as ${session.email}. Sign out and open the link again.`
      );
    }
    existingUserId = session.id;
  } else {
    const existing = await findUserByEmail(inviteEmail);
    if (existing) {
      if (!existing.password) {
        return fail(409, 'SIGN_IN_REQUIRED', 'This email uses Google sign-in. Continue with Google to accept the invitation.');
      }
      if (!password) return fail(422, 'PASSWORD_REQUIRED', 'Enter your FlowSync password to accept.');
      const ok = await bcrypt.compare(password, existing.password);
      if (!ok) return fail(401, 'INVALID_PASSWORD', 'Incorrect password for this account.');
      existingUserId = existing.id;
      actorName = existing.name;
    } else {
      const cleanName = (name || '').trim();
      if (cleanName.length < 2) return fail(422, 'NAME_REQUIRED', 'Please enter your full name.');
      const passwordError = validateNewPassword(password || '');
      if (passwordError) return fail(422, 'WEAK_PASSWORD', passwordError);
      newAccount = { name: cleanName, passwordHash: await bcrypt.hash(password!, 10) };
      actorName = cleanName;
    }
  }

  let userId: string;
  try {
    userId = await prisma.$transaction(async tx => {
      // Claim the invitation first — if two requests race, only one succeeds
      const claimed = await tx.projectInvitation.updateMany({
        where: { id: inv.id, status: 'pending' },
        data: { status: 'accepted', respondedAt: new Date() },
      });
      if (claimed.count === 0) throw new InviteAlreadyUsedError();

      let uid = existingUserId;
      if (!uid && newAccount) {
        const created = await tx.user.create({
          data: {
            name: newAccount.name,
            email: inviteEmail,
            password: newAccount.passwordHash,
            // The invitee joins the company with the role the admin chose
            role: toCompanyRole(inv.role),
            avatar: initialsFor(newAccount.name),
            teamId: inv.project.teamId,
            emailVerified: new Date(), // the invitation link proves the email address
            hasCompletedOnboarding: Boolean(inv.project.teamId),
          },
          select: { id: true },
        });
        uid = created.id;
        if (inv.project.teamId) {
          await tx.teamMembership.create({ data: { teamId: inv.project.teamId, userId: uid, role: toCompanyRole(inv.role) } });
        }
      }

      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: inv.projectId, userId: uid! } },
        create: { projectId: inv.projectId, userId: uid!, role: toCompanyRole(inv.role) },
        update: {}, // already a member — keep their current role
      });
      return uid!;
    });
  } catch (err) {
    if (err instanceof InviteAlreadyUsedError) {
      return fail(409, 'ALREADY_RESPONDED', 'This invitation has already been used.');
    }
    throw err;
  }

  // An existing account joins the project's company too, with the invited role — keeping every
  // other company and their personal workspace — and lands in this company's project
  if (inv.project.teamId) {
    if (!newAccount) await joinCompany(userId, inv.project.teamId, inv.role).catch(() => 'skipped');
    await switchWorkspace(userId, inv.project.teamId).catch(() => null);
  }

  if (!actorName) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    actorName = u?.name || inviteEmail;
  }

  await Promise.allSettled([
    notifyInviter(inv, 'accepted', actorName),
    redisCache.delPattern('projects:*'),
    redisCache.delPattern('project:detail:*'),
    redisCache.del(`tenant:${userId}`),
    redisCache.delPattern('team:members:*'),
  ]);

  return NextResponse.json({
    success: true,
    message: `You joined ${inv.project.name}.`,
    data: {
      type: 'project',
      projectId: inv.projectId,
      projectName: inv.project.name,
      email: inviteEmail,
      isNewAccount: Boolean(newAccount),
      onboardingNeeded: Boolean(newAccount),
    },
  });
}

async function acceptTeamInvite(token: string, name: string | undefined, password: string | undefined) {
  const invitation = await prisma.teamInvitation.findUnique({ where: { token }, include: { team: true } });
  if (!invitation || invitation.status !== 'pending' || new Date() > invitation.expiresAt) {
    return fail(400, 'INVALID_INVITE', 'This invitation is invalid or has expired');
  }

  const inviteEmail = invitation.email.toLowerCase();
  const assignedRole =
    invitation.role === 'ADMIN' ? 'Admin' : invitation.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member';
  const session = await currentUser();
  let onboardingNeeded = false;

  if (session) {
    if (session.email !== inviteEmail) {
      return fail(
        403,
        'EMAIL_MISMATCH',
        `This invitation was sent to ${invitation.email}, but you're signed in as ${session.email}. Sign out and open the link again.`
      );
    }
    await addMembership(session.id, invitation.teamId, assignedRole);
    await switchWorkspace(session.id, invitation.teamId);
  } else {
    const existing = await findUserByEmail(inviteEmail);
    if (existing) {
      if (!existing.password) {
        return fail(409, 'SIGN_IN_REQUIRED', 'This email uses Google sign-in. Continue with Google to accept the invitation.');
      }
      if (!password) return fail(422, 'PASSWORD_REQUIRED', 'Enter your password to accept.');
      if (!(await bcrypt.compare(password, existing.password))) {
        return fail(401, 'INVALID_PASSWORD', 'Incorrect password for this account.');
      }
      if (!existing.emailVerified) {
        await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
      }
      await addMembership(existing.id, invitation.teamId, assignedRole);
      await switchWorkspace(existing.id, invitation.teamId);
    } else {
      const passwordError = validateNewPassword(password || '');
      if (passwordError) return fail(422, 'WEAK_PASSWORD', passwordError);
      const userName = (name || '').trim() || inviteEmail.split('@')[0];
      const created = await prisma.user.create({
        data: {
          name: userName,
          email: inviteEmail,
          password: await bcrypt.hash(password!, 10),
          role: assignedRole,
          avatar: initialsFor(userName),
          teamId: invitation.teamId,
          emailVerified: new Date(),
          hasCompletedOnboarding: true,
        },
        select: { id: true },
      });
      await addMembership(created.id, invitation.teamId, assignedRole);
      onboardingNeeded = true;
    }
  }

  // The starting password is no longer needed once the invitation is used
  await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'accepted', initialPassword: null } });
  await redisCache.delPattern('team:members:*').catch(() => {});

  return NextResponse.json({
    success: true,
    message: `You joined ${invitation.team.name}.`,
    data: { type: 'team', teamId: invitation.team.id, teamName: invitation.team.name, email: inviteEmail, onboardingNeeded },
  });
}
