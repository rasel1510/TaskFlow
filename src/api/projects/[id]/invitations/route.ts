/**
 * src/api/projects/[id]/invitations/route.ts
 *
 * Project Member Invitation Workflow
 * Project Managers can invite any person via email.
 *
 * GET    /api/projects/:id/invitations — List pending invitations for this project
 * POST   /api/projects/:id/invitations — Create & send project invitation email
 * DELETE /api/projects/:id/invitations?inviteId=... — Revoke a pending invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requireProjectAccess, canManageProject, isProjectAdmin, forbidden } from '@/lib/access';
import { ProjectEmailInviteSchema, validationError } from '@/lib/validators';
import { sendProjectInviteEmail } from '@/lib/mail';
import { getAppOrigin } from '@/lib/origin';
import { ROLE_DESCRIPTIONS, type ProjectRole } from '@/lib/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface ProjectInvitationRecord {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  status: string;
  invitedByName: string;
  invitedByEmail: string;
  expiresAt: string;
  createdAt: string;
  token?: string;
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/invitations — List pending project invitations
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    // Invite tokens are bearer credentials — only managers may see them (for "Copy Link")
    const canSeeTokens = canManageProject(access.value);

    const invitations = await prisma.projectInvitation.findMany({
      where: {
        projectId,
        status: 'pending',
      },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const formatted: ProjectInvitationRecord[] = invitations.map(inv => ({
      id: inv.id,
      projectId: inv.projectId,
      email: inv.email,
      role: inv.role as ProjectRole,
      status: inv.expiresAt < now ? 'expired' : inv.status,
      invitedByName: inv.invitedBy?.name || 'Project Manager',
      invitedByEmail: inv.invitedBy?.email || '',
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      token: canSeeTokens ? inv.token : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: formatted.map(inv => ({
        ...inv,
        roleConfig: ROLE_DESCRIPTIONS[inv.role] || ROLE_DESCRIPTIONS.CONTRIBUTOR,
      })),
    });
  } catch (error) {
    console.error('[GET /api/projects/:id/invitations] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch project invitations' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/:id/invitations — Send project invitation email
// ---------------------------------------------------------------------------
const INVITE_EXPIRY_DAYS = 7;
const RESEND_COOLDOWN_MS = 30_000;

/** Roles an invitation can grant (project-level). Admin can only be granted by full project admins. */
const INVITABLE_ROLES = new Set(['Member', 'Project Manager', 'Admin', 'CONTRIBUTOR', 'LEAD', 'VIEWER']);

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (!canManageProject(access.value)) {
      return forbidden('Only the project owner, Admins or project managers can invite people');
    }
    const inviter = access.value.user;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request body' } },
        { status: 400 }
      );
    }

    const parsed = ProjectEmailInviteSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const email = parsed.data.email.trim().toLowerCase();
    const role = parsed.data.role;

    if (!INVITABLE_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'This role cannot be granted by invitation' } },
        { status: 400 }
      );
    }
    if (role === 'Admin' && !isProjectAdmin(access.value)) {
      return forbidden('Only the project owner or an Admin can invite someone as a project Admin');
    }
    if (email === inviter.email) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: "You can't invite yourself" } },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, color: true, ownerId: true, team: { select: { name: true } }, owner: { select: { email: true } } },
    });
    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Already in the project (as owner or member)?
    if (project.owner?.email?.toLowerCase() === email) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_MEMBER', message: `${email} owns this project.` } },
        { status: 409 }
      );
    }
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId, user: { email: { equals: email, mode: 'insensitive' } } },
      select: { role: true, user: { select: { name: true } } },
    });
    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ALREADY_MEMBER', message: `${existingMember.user.name || email} is already a member of this project.` },
        },
        { status: 409 }
      );
    }

    // Guard against accidental double-sends
    const recent = await prisma.projectInvitation.findFirst({
      where: { projectId, email: { equals: email, mode: 'insensitive' }, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json(
        { success: false, error: { code: 'TOO_SOON', message: 'An invitation was just sent to this address. Please wait a moment before resending.' } },
        { status: 429 }
      );
    }

    // Only the newest invitation link stays valid
    await prisma.projectInvitation.updateMany({
      where: { projectId, email: { equals: email, mode: 'insensitive' }, status: 'pending' },
      data: { status: 'revoked' },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await prisma.projectInvitation.create({
      data: { projectId, email, role, token, status: 'pending', invitedById: inviter.id, expiresAt },
    });

    const origin = getAppOrigin(request);
    const inviteUrl = `${origin}/invite/accept?token=${token}`;
    const declineUrl = `${inviteUrl}&action=decline`;

    const inviterRecord = await prisma.user.findUnique({ where: { id: inviter.id }, select: { name: true, email: true } });
    const inviterName = inviterRecord?.name || inviter.email.split('@')[0] || 'A teammate';

    const mailResult = await sendProjectInviteEmail({
      to: email,
      inviterName,
      inviterEmail: inviterRecord?.email || inviter.email,
      projectName: project.name,
      projectColor: project.color || '#2563EB',
      organizationName: project.team?.name ?? null,
      inviteUrl,
      declineUrl,
      role,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });

    if (!mailResult.success && !mailResult.devMode) {
      console.error('[POST /api/projects/:id/invitations] Mail delivery failed:', mailResult.error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_DISPATCH_FAILED',
            message: 'The invitation was created, but the email could not be sent. Check the SMTP settings, or copy the invite link from the Team tab.',
          },
          data: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() },
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: mailResult.devMode ? `Invitation created (email not sent — SMTP not configured).` : `Invitation sent to ${email}`,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          // Dev-only convenience when SMTP is not configured — never expose links in production responses
          devPreviewUrl: process.env.NODE_ENV !== 'production' && mailResult.devMode ? inviteUrl : undefined,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/projects/:id/invitations] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send project invitation' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id/invitations?inviteId=... — Revoke invitation
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (!canManageProject(access.value)) {
      return forbidden('Only project managers can revoke invitations');
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'inviteId query parameter is required' } },
        { status: 400 }
      );
    }

    const invitation = await prisma.projectInvitation.findFirst({
      where: { id: inviteId, projectId },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
        { status: 404 }
      );
    }

    await prisma.projectInvitation.update({
      where: { id: inviteId },
      data: { status: 'revoked' },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation successfully revoked',
    });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/invitations] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' } },
      { status: 500 }
    );
  }
}
