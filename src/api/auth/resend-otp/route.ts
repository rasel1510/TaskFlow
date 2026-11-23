import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOtp, storeVerificationOtp } from '@/lib/verification';
import { sendVerificationOtpEmail } from '@/lib/mail';
import prisma from '@/lib/prisma';

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

    // Lookup user name if available
    let userName: string | undefined;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { name: true },
      });
      if (dbUser) userName = dbUser.name;
    } catch {
      // name is optional in the email
    }

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
