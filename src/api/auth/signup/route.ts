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

    const { name, email: normalizedEmail, password, role: userRole } = parsed.data;
    const normalizedRole =
      userRole?.trim().toLowerCase() === 'project manager'
        ? 'Project Manager'
        : userRole?.trim().toLowerCase() === 'admin'
        ? 'Admin'
        : 'User';

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
      // Check for duplicate email in database
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { message: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      // Persist new user in database with unverified email state
      const newUser = await prisma.user.create({
        data: {
          name: (name as string).trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: normalizedRole,
          avatar,
          emailVerified: null,
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
      });
    } catch (dbError) {
      // Database unavailable / auth failure — persist safely to userStore
      console.warn('[POST /api/auth/signup] Prisma unavailable, saving to local store:', dbError);

      const storedUser = saveStoredUser({
        name: (name as string).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: normalizedRole,
        avatar,
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
        previewCode: mailResult.previewCode,
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
