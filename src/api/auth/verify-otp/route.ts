import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/verification';

const VerifyOtpSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

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

    const parsed = VerifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Invalid verification request';
      return NextResponse.json({ success: false, message: issue }, { status: 422 });
    }

    const { email, code } = parsed.data;

    const result = await verifyOtp(email, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: result.message,
    });
  } catch (error) {
    console.error('[POST /api/auth/verify-otp] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error verifying code' },
      { status: 500 }
    );
  }
}
