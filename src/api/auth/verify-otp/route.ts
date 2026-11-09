import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/verification';
import { issueResetToken } from '@/lib/resetTokenStore';
import { sendSignupNotificationEmail } from '@/lib/mail';

const VerifyOtpSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
  /**
   * Optional: 'signup' (default) | 'password-reset'
   * When 'password-reset', a short-lived resetToken is returned on success.
   */
  purpose: z.enum(['signup', 'password-reset']).optional().default('signup'),
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

    const { email, code, purpose } = parsed.data;

    const result = await verifyOtp(email, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    // For password-reset flow, issue a short-lived server-side reset token
    if (purpose === 'password-reset') {
      const resetToken = issueResetToken(email);
      return NextResponse.json({
        success: true,
        verified: true,
        resetToken,
        message: 'Code verified. You may now set a new password.',
      });
    }

    // For signup flow, dispatch welcome notification email asynchronously
    sendSignupNotificationEmail({
      to: email,
      signupMethod: 'Email & Password',
    }).catch(err => console.error('[Signup OTP welcome email error]:', err));

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
