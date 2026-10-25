import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

const AcceptInviteSchema = z.object({
  token: z.string().min(10, 'Valid token is required'),
  name: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

// ---------------------------------------------------------------------------
// GET /api/team/invite/accept?token=... — Verify token details
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invitation token is missing' } },
        { status: 400 }
      );
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found or link has expired' } },
        { status: 404 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_USED', message: `This invitation is already ${invitation.status}` } },
        { status: 400 }
      );
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { success: false, error: { code: 'EXPIRED', message: 'This invitation has expired. Please ask the project manager to resend.' } },
        { status: 410 }
      );
    }

    // Check if a user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, name: true, teamId: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        token: invitation.token,
        email: invitation.email,
        role: invitation.role,
        teamName: invitation.team.name,
        teamId: invitation.team.id,
        inviterName: invitation.invitedBy?.name || 'Your Project Manager',
        userExists: !!existingUser,
        alreadyInTeam: existingUser?.teamId === invitation.team.id,
      },
    });
  } catch (error) {
    console.error('[GET /api/team/invite/accept] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify invitation' } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/team/invite/accept — Accept invitation & join team
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const parsed = AcceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } },
        { status: 422 }
      );
    }

    const { token, name, password } = parsed.data;

    // Fetch invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!invitation || invitation.status !== 'pending' || new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INVITE', message: 'This invitation is invalid or has expired' } },
        { status: 400 }
      );
    }

    const session = await auth();
    const sessionUserId = session?.user?.id;
    let targetUserId = sessionUserId;

    if (targetUserId) {
      // 1. Logged in user accepting invite:
      // Single-team constraint: update user's teamId and role
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          teamId: invitation.teamId,
          role: invitation.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'User',
        },
      });
    } else {
      // 2. Unauthenticated user accepting invite:
      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (existingUser) {
        // User account already exists
        if (password) {
          if (existingUser.password) {
            const isValid = await bcrypt.compare(password, existingUser.password);
            if (!isValid) {
              return NextResponse.json(
                { success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect password for this existing account' } },
                { status: 401 }
              );
            }
          }
        }
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            teamId: invitation.teamId,
            role: invitation.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'User',
            emailVerified: existingUser.emailVerified || new Date(),
          },
        });
        targetUserId = existingUser.id;
      } else {
        // Create new user account with single team constraint
        if (!name || !password) {
          return NextResponse.json(
            { success: false, error: { code: 'REGISTRATION_REQUIRED', message: 'Full name and password are required to create your account' } },
            { status: 422 }
          );
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const initials = name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

        const newUser = await prisma.user.create({
          data: {
            name: name.trim(),
            email: invitation.email,
            password: hashedPassword,
            role: invitation.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'User',
            avatar: initials || 'MB',
            teamId: invitation.teamId,
            emailVerified: new Date(),
          },
        });
        targetUserId = newUser.id;
      }
    }

    // Mark invitation as accepted
    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    });

    return NextResponse.json({
      success: true,
      message: `You have successfully joined ${invitation.team.name}!`,
      data: {
        teamId: invitation.team.id,
        teamName: invitation.team.name,
        email: invitation.email,
      },
    });
  } catch (error) {
    console.error('[POST /api/team/invite/accept] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process invitation acceptance' } },
      { status: 500 }
    );
  }
}
