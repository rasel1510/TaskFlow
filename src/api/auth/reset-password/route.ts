import { NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeResetToken } from '@/lib/resetTokenStore';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const ResetPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  resetToken: z.string().min(16, 'Invalid reset token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
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

    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Invalid reset request';
      return NextResponse.json({ success: false, message: issue }, { status: 422 });
    }

    const { email, resetToken, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Validate and consume the reset token (single-use, 15-min TTL)
    const valid = consumeResetToken(normalizedEmail, resetToken);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: 'Reset session expired or invalid. Please start over.' },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt (cost=12)
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update in DB
    let dbUpdated = false;
    try {
      const result = await prisma.user.updateMany({
        where: { email: normalizedEmail },
        data: { password: hashedPassword },
      });
      dbUpdated = result.count > 0;
    } catch (err) {
      console.error('[reset-password] DB update error:', err);
    }

    if (!dbUpdated) {
      return NextResponse.json(
        { success: false, message: 'Account not found. Please sign up.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
