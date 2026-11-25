import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOtp, storeVerificationOtp } from '@/lib/verification';
import { sendVerificationOtpEmail } from '@/lib/mail';
import prisma from '@/lib/prisma';
import { overLimit, HOUR } from '@/lib/abuseGuard';

const ResendOtpSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

// Simple in-memory rate limiting map (at most 1 resend per 30 seconds per email)
const resendRateLimitMap = new Map<string, number>();

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

    const parsed = ResendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Valid email is required' },
        { status: 422 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting check
    const lastSent = resendRateLimitMap.get(normalizedEmail);
    const now = Date.now();
    if (lastSent && now - lastSent < 30000) {
      const waitSeconds = Math.ceil((30000 - (now - lastSent)) / 1000);
      return NextResponse.json(
        { success: false, message: `Please wait ${waitSeconds}s before requesting a new code.` },
        { status: 429 }
      );
    }

    // Durable per-address limit on code emails (shared by every server instance)
    if (await overLimit('mail', normalizedEmail, 5, HOUR)) {
      return NextResponse.json(
        { success: false, message: 'Too many codes requested for this email. Please try again in an hour.' },
        { status: 429 }
      );
    }

    // Codes are only sent to accounts still waiting for email verification. The reply is the same
    // either way, so this can't be used to discover accounts or to email arbitrary addresses.
    let userName: string | undefined;
    const dbUser = await prisma.user
      .findUnique({ where: { email: normalizedEmail }, select: { name: true, emailVerified: true } })
      .catch(() => null);
    if (!dbUser || dbUser.emailVerified) {
      return NextResponse.json({ success: true, message: 'A fresh verification code has been dispatched.' });
    }
    userName = dbUser.name;

    // Generate new OTP
    const otp = generateOtp();
    await storeVerificationOtp(normalizedEmail, otp, 10);
    resendRateLimitMap.set(normalizedEmail, now);

    // Send email
    const mailResult = await sendVerificationOtpEmail({
      to: normalizedEmail,
      name: userName,
      otp,
      expiresInMinutes: 10,
    });

    return NextResponse.json({
      success: true,
      message: 'A fresh verification code has been dispatched.',
      devMode: mailResult.devMode,
      // Dev-only convenience when SMTP is not configured — never expose codes in production
        previewCode: process.env.NODE_ENV !== 'production' ? mailResult.previewCode : undefined,
    });
  } catch (error) {
    console.error('[POST /api/auth/resend-otp] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to resend verification code' },
      { status: 500 }
    );
  }
}
