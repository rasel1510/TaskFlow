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
import { auth } from '@/auth';
import { ProjectEmailInviteSchema, validationError } from '@/lib/validators';
import { sendProjectInviteEmail } from '@/lib/mail';
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
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/invitations — List pending project invitations
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

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
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be logged in to send invitations' } },
        { status: 401 }
      );
    }

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

    const { email, role } = parsed.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, color: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Verify inviter permissions (must be Project Owner, Lead, or Project Manager role)
    const isOwner = project.ownerId === session.user.id;
    const projectMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: session.user.id } },
      select: { role: true },
    });
    const isManagerRole = (session.user as any).role === 'Project Manager' || (session.user as any).role === 'Admin';
    const canInvite = isOwner || isManagerRole || projectMembership?.role === 'OWNER' || projectMembership?.role === 'LEAD';

    if (!canInvite) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only project owners, leads, or managers can invite new members.' } },
        { status: 403 }
      );
    }

    // Check if target user is already an active member of this project
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_MEMBER',
            message: `${existingMember.user.name || email} is already a member of this project (${existingMember.role}).`,
          },
        },
        { status: 409 }
      );
    }

    // Revoke any previous pending invitations for this email on this project
    await prisma.projectInvitation.updateMany({
      where: {
        projectId,
        email: { equals: email, mode: 'insensitive' },
        status: 'pending',
      },
      data: { status: 'revoked' },
    });

    // Generate secure cryptographically random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresInDays = 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.projectInvitation.create({
      data: {
        projectId,
        email,
        role,
        token,
        status: 'pending',
        invitedById: session.user.id,
        expiresAt,
      },
    });

    // Construct invitation link
    const origin = request.headers.get('origin') || request.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const inviteUrl = `${origin}/invite/accept?token=${token}`;

    const inviterName = session.user.name || session.user.email?.split('@')[0] || 'Project Manager';

    // Dispatch email
    const mailResult = await sendProjectInviteEmail({
      to: email,
      inviterName,
      projectName: project.name,
      projectColor: project.color || '#2563EB',
      inviteUrl,
      role,
      expiresInDays,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invitation email successfully sent to ${email}`,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          devPreviewUrl: mailResult.previewCode,
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
