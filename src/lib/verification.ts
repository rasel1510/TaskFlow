import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { attemptCount, clearAttempts, recordAttempt, MINUTE } from '@/lib/abuseGuard';

/**
 * Email verification codes (6 digits), stored in the database only — never in memory or files —
 * so every server instance sees the same code. Wrong guesses are limited: after 5 wrong codes
 * the code is cancelled and a new one must be requested (stops brute-forcing 900,000 codes).
 */

const MAX_WRONG_GUESSES = 5;
const GUESS_WINDOW_MS = 15 * MINUTE;

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store a 6-digit OTP code for an email with an expiration window (default 10 minutes).
 * Replaces any earlier code for that email and resets its wrong-guess count.
 */
export async function storeVerificationOtp(
  email: string,
  code: string,
  expiresInMinutes = 10
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await prisma.verificationCode.deleteMany({ where: { email: normalizedEmail } });
  await prisma.verificationCode.create({
    data: {
      id: `otp_${crypto.randomBytes(9).toString('hex')}`,
      email: normalizedEmail,
      code: code.trim(),
      expiresAt,
    },
  });
  await clearAttempts('otp', normalizedEmail);
}

/**
 * Verify a 6-digit OTP code for an email.
 * If valid, marks the user's emailVerified date and invalidates the code.
 */
export async function verifyOtp(
  email: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedCode = code.trim();
  const invalid = {
    success: false,
    message: 'Invalid verification code. Please check your email or request a new code.',
  };

  // Too many wrong guesses → the code is cancelled; a new one must be requested
  if ((await attemptCount('otp', normalizedEmail)) >= MAX_WRONG_GUESSES) {
    await prisma.verificationCode.deleteMany({ where: { email: normalizedEmail } }).catch(() => {});
    return { success: false, message: 'Too many incorrect codes. Please request a new code.' };
  }

  const record = await prisma.verificationCode.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: 'desc' },
    select: { code: true, expiresAt: true },
  });
  if (!record) return invalid;

  const a = Buffer.from(record.code);
  const b = Buffer.from(trimmedCode);
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!matches) {
    await recordAttempt('otp', normalizedEmail, GUESS_WINDOW_MS);
    return invalid;
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.verificationCode.deleteMany({ where: { email: normalizedEmail } }).catch(() => {});
    return {
      success: false,
      message: 'This verification code has expired. Please request a new one.',
    };
  }

  // Valid — the code is single-use
  await prisma.verificationCode.deleteMany({ where: { email: normalizedEmail } }).catch(() => {});
  await clearAttempts('otp', normalizedEmail);

  // Mark user as verified in database
  await prisma.user.updateMany({ where: { email: normalizedEmail }, data: { emailVerified: new Date() } }).catch(() => {});

  return {
    success: true,
    message: 'Email verified successfully! Workspace access granted.',
  };
}
