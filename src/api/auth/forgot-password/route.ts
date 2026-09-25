import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOtp, storeVerificationOtp } from '@/lib/verification';
import { sendVerificationOtpEmail } from '@/lib/mail';
import { findStoredUserByEmail } from '@/data/userStore';
import prisma from '@/lib/prisma';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

// Rate limiting: 1 request per 30 seconds per email
const rateLimitMap = new Map<string, number>();

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'A valid email address is required' },
        { status: 422 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit check
    const lastSent = rateLimitMap.get(normalizedEmail);
    const now = Date.now();
    if (lastSent && now - lastSent < 30_000) {
      const waitSeconds = Math.ceil((30_000 - (now - lastSent)) / 1000);
      return NextResponse.json(
        { success: false, message: `Please wait ${waitSeconds}s before requesting a new code.` },
        { status: 429 }
      );
    }

    // Lookup user — local store first (O(1)), then DB
    let userName: string | undefined;
    let userFound = false;

    const localUser = findStoredUserByEmail(normalizedEmail);
    if (localUser) {
      userName = localUser.name;
      userFound = true;
    } else {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { name: true },
        });
        if (dbUser) {
          userName = dbUser.name ?? undefined;
          userFound = true;
        }
      } catch {
        // non-critical — proceed
      }
    }

    rateLimitMap.set(normalizedEmail, now);

    // Always respond identically whether email exists or not (prevents enumeration)
    if (userFound) {
      const otp = generateOtp();
      await storeVerificationOtp(normalizedEmail, otp, 10);

      const mailResult = await sendVerificationOtpEmail({
        to: normalizedEmail,
        name: userName,
        otp,
        expiresInMinutes: 10,
      });

      return NextResponse.json({
        success: true,
        message: 'If an account exists for this email, a reset code has been sent.',
        devMode: mailResult.devMode,
        previewCode: mailResult.previewCode,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for this email, a reset code has been sent.',
    });
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
