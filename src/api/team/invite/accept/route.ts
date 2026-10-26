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
// GET /api/team/invite/accept?token=... — Verify token details (Project or Team)
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

    // 1. Check if token belongs to a Project Invitation
    const projectInvitation = await prisma.projectInvitation.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            teamId: true,
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

    if (projectInvitation) {
      if (projectInvitation.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: { code: 'ALREADY_USED', message: `This invitation is already ${projectInvitation.status}` } },
          { status: 400 }
        );
      }

      if (new Date() > projectInvitation.expiresAt) {
        await prisma.projectInvitation.update({
          where: { id: projectInvitation.id },
          data: { status: 'expired' },
        });
        return NextResponse.json(
          { success: false, error: { code: 'EXPIRED', message: 'This invitation has expired. Please ask the project manager to resend.' } },
          { status: 410 }
        );
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: projectInvitation.email },
        select: { id: true, name: true, teamId: true },
      });

      let alreadyMember = false;
      if (existingUser) {
        const memberRecord = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: projectInvitation.projectId,
              userId: existingUser.id,
            },
          },
        });
        alreadyMember = !!memberRecord;
      }

      return NextResponse.json({
        success: true,
        data: {
          type: 'project',
          token: projectInvitation.token,
          email: projectInvitation.email,
          role: projectInvitation.role,
          projectId: projectInvitation.project.id,
          projectName: projectInvitation.project.name,
          projectColor: projectInvitation.project.color || '#2563EB',
          inviterName: projectInvitation.invitedBy?.name || 'Project Manager',
          userExists: !!existingUser,
          alreadyInTeam: alreadyMember,
        },
      });
    }

    // 2. Fall back to Team Invitation
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
        type: 'team',
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
// POST /api/team/invite/accept — Accept invitation (Project or Team) & set password
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

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Process Project Invitation
    // ─────────────────────────────────────────────────────────────────────────
    const projectInvitation = await prisma.projectInvitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (projectInvitation) {
      if (projectInvitation.status !== 'pending' || new Date() > projectInvitation.expiresAt) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_INVITE', message: 'This invitation is invalid or has expired' } },
          { status: 400 }
        );
      }

      const session = await auth();
      let targetUserId = session?.user?.id;
      let onboardingNeeded = false;

      if (targetUserId) {
        // Authenticated user accepting project invitation
        await prisma.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: projectInvitation.projectId,
              userId: targetUserId,
            },
          },
          create: {
            projectId: projectInvitation.projectId,
            userId: targetUserId,
            role: projectInvitation.role,
          },
          update: {
            role: projectInvitation.role,
          },
        });
      } else {
        // Unauthenticated user accepting invitation
        const existingUser = await prisma.user.findUnique({
          where: { email: projectInvitation.email },
        });

        if (existingUser) {
          if (password && existingUser.password) {
            const isValid = await bcrypt.compare(password, existingUser.password);
            if (!isValid) {
              return NextResponse.json(
                { success: false, error: { code: 'INVALID_PASSWORD', message: 'Incorrect password for this account' } },
                { status: 401 }
              );
            }
          }
          await prisma.projectMember.upsert({
            where: {
              projectId_userId: {
                projectId: projectInvitation.projectId,
                userId: existingUser.id,
              },
            },
            create: {
              projectId: projectInvitation.projectId,
              userId: existingUser.id,
              role: projectInvitation.role,
            },
            update: {
              role: projectInvitation.role,
            },
          });
          targetUserId = existingUser.id;
        } else {
          // Brand new user accepting with password!
          if (!password) {
            return NextResponse.json(
              { success: false, error: { code: 'PASSWORD_REQUIRED', message: 'Please create a password to accept your invitation' } },
              { status: 422 }
            );
          }

          const hashedPassword = await bcrypt.hash(password, 10);
          const userName = name?.trim() || 'New Member';
          const initials = userName === 'New Member' ? 'MB' : userName.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

          const newUser = await prisma.user.create({
            data: {
              name: userName,
              email: projectInvitation.email,
              password: hashedPassword,
              role: projectInvitation.role === 'LEAD' ? 'Project Manager' : 'User',
              avatar: initials || 'MB',
              teamId: projectInvitation.project.teamId,
              emailVerified: new Date(),
            },
          });

          await prisma.projectMember.create({
            data: {
              projectId: projectInvitation.projectId,
              userId: newUser.id,
              role: projectInvitation.role,
            },
          });

          targetUserId = newUser.id;
          onboardingNeeded = true;
        }
      }

      // Mark project invitation as accepted
      await prisma.projectInvitation.update({
        where: { id: projectInvitation.id },
        data: { status: 'accepted' },
      });

      return NextResponse.json({
        success: true,
        message: `You have successfully joined ${projectInvitation.project.name}!`,
        data: {
          type: 'project',
          projectId: projectInvitation.projectId,
          projectName: projectInvitation.project.name,
          email: projectInvitation.email,
          onboardingNeeded,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Process Team Invitation
    // ─────────────────────────────────────────────────────────────────────────
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
    let onboardingNeeded = false;

    const assignedRole =
      invitation.role === 'ADMIN'
        ? 'Admin'
        : invitation.role === 'PROJECT_MANAGER'
        ? 'Project Manager'
        : 'User';

    if (targetUserId) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          teamId: invitation.teamId,
          role: assignedRole,
        },
      });
    } else {
      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (existingUser) {
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
            role: assignedRole,
            emailVerified: existingUser.emailVerified || new Date(),
          },
        });
        targetUserId = existingUser.id;
      } else {
        if (!password) {
          return NextResponse.json(
            { success: false, error: { code: 'REGISTRATION_REQUIRED', message: 'A password is required to create your account' } },
            { status: 422 }
          );
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userName = name?.trim() || 'New Member';
        const initials = userName === 'New Member' ? 'MB' : userName.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

        const newUser = await prisma.user.create({
          data: {
            name: userName,
            email: invitation.email,
            password: hashedPassword,
            role: assignedRole,
            avatar: initials || 'MB',
            teamId: invitation.teamId,
            emailVerified: new Date(),
          },
        });
        targetUserId = newUser.id;
        onboardingNeeded = true;
      }
    }

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    });

    return NextResponse.json({
      success: true,
      message: `You have successfully joined ${invitation.team.name}!`,
      data: {
        type: 'team',
        teamId: invitation.team.id,
        teamName: invitation.team.name,
        email: invitation.email,
        onboardingNeeded,
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
