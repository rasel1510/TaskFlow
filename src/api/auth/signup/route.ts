import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { findStoredUserByEmail, saveStoredUser } from '@/data/userStore';
import { SignupSchema, validationError } from '@/lib/validators';
import { generateOtp, storeVerificationOtp } from '@/lib/verification';
import { sendVerificationOtpEmail } from '@/lib/mail';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate initials avatar string from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    // --- Zod validation ---
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { name, email: normalizedEmail, password, teamName } = parsed.data;
    // Whoever creates account will be Admin automatically
    const normalizedRole = 'Admin';
    const cleanTeamName = teamName?.trim() || `${(name as string).trim()}'s Team`;

    const avatar = getInitials(name);
    const hashedPassword = await bcrypt.hash(password, 10);

    // First check fallback store for existing account
    const existingStored = findStoredUserByEmail(normalizedEmail);
    if (existingStored) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    let createdUserId: string | undefined;

    try {
      // Check if user has a pending team invitation
      const pendingInvite = await prisma.teamInvitation.findFirst({
        where: {
          email: normalizedEmail,
          status: 'pending',
        },
        include: { team: true },
      });

      // Check for duplicate email in database
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // If user already verified and has no pending invitation to join
        if (existingUser.emailVerified && !pendingInvite) {
          return NextResponse.json(
            { message: 'An account with this email already exists' },
            { status: 409 }
          );
        }

        // Invited or unverified pre-provisioned user completing signup!
        const targetTeamId = pendingInvite?.teamId || existingUser.teamId;
        const targetRole = pendingInvite
          ? (pendingInvite.role === 'ADMIN' ? 'Admin' : pendingInvite.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member')
          : existingUser.role;

        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: (name as string).trim(),
            password: hashedPassword,
            role: targetRole,
            avatar,
            teamId: targetTeamId,
          },
        });

        if (pendingInvite) {
          await prisma.teamInvitation.update({
            where: { id: pendingInvite.id },
            data: { status: 'accepted' },
          });
        }

        createdUserId = updatedUser.id;

        saveStoredUser({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          password: hashedPassword,
          role: updatedUser.role,
          avatar: updatedUser.avatar,
          teamId: targetTeamId || '',
          teamName: pendingInvite?.team.name || cleanTeamName,
        });
      } else if (pendingInvite) {
        // Brand new user accepting team invitation via signup
        const targetRole =
          pendingInvite.role === 'ADMIN' ? 'Admin' : pendingInvite.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Member';

        const newUser = await prisma.user.create({
          data: {
            name: (name as string).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: targetRole,
            avatar,
            teamId: pendingInvite.teamId,
            emailVerified: null,
          },
        });

        await prisma.teamInvitation.update({
          where: { id: pendingInvite.id },
          data: { status: 'accepted' },
        });

        createdUserId = newUser.id;

        saveStoredUser({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          password: hashedPassword,
          role: newUser.role,
          avatar: newUser.avatar,
          teamId: pendingInvite.teamId,
          teamName: pendingInvite.team.name,
        });
      } else {
        // Standard user signup — account created first without company
        // Company will be created later on /onboarding/organization where this user becomes Admin
        const newUser = await prisma.user.create({
          data: {
            name: (name as string).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: normalizedRole,
            avatar,
            teamId: null,
            emailVerified: null,
            hasCompletedOnboarding: false,
          },
        });

        createdUserId = newUser.id;

        // Also persist to local userStore for seamless failover
        saveStoredUser({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          password: hashedPassword,
          role: newUser.role,
          avatar: newUser.avatar,
          teamId: '',
          teamName: '',
        });
      }
    } catch (dbError) {
      // Database unavailable / auth failure — persist safely to userStore
      console.warn('[POST /api/auth/signup] Prisma unavailable, saving to local store:', dbError);

      const fallbackTeamId = `team_${Date.now()}`;
      const storedUser = saveStoredUser({
        name: (name as string).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: normalizedRole,
        avatar,
        teamId: fallbackTeamId,
        teamName: cleanTeamName,
      });

      createdUserId = storedUser.id;
    }

    // --- SMTP Verification Phase ---
    // Generate secure 6-digit OTP
    const otp = generateOtp();

    // Store OTP in database & memory store
    await storeVerificationOtp(normalizedEmail, otp, 10);

    // Dispatch verification email via SMTP
    const mailResult = await sendVerificationOtpEmail({
      to: normalizedEmail,
      name: (name as string).trim(),
      otp,
      expiresInMinutes: 10,
    });

    return NextResponse.json(
      {
        success: true,
        requiresVerification: true,
        email: normalizedEmail,
        userId: createdUserId,
        devMode: mailResult.devMode,
        // Dev-only convenience when SMTP is not configured — never expose codes in production
        previewCode: process.env.NODE_ENV !== 'production' ? mailResult.previewCode : undefined,
        message: mailResult.devMode
          ? 'Verification code generated (check server logs or preview below).'
          : 'A 6-digit verification code has been dispatched to your email.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/auth/signup] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error while processing signup' },
      { status: 500 }
    );
  }
}
