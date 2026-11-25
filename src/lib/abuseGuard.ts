/**
 * src/lib/abuseGuard.ts — durable attempt counters and limits shared by every server instance.
 *
 * Serverless functions run on many instances, so in-memory counters are easy to bypass. These
 * counters live in the database (as short-lived rows in the VerificationCode table, keyed
 * "rl:<bucket>:<key>" so they never collide with real codes), and expire on their own.
 *
 * Used for: wrong one-time-code guesses, sign-in attempts, emails sent to an address, AI
 * assistant requests and invitations.
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export type Bucket = 'otp' | 'login' | 'mail' | 'copilot' | 'invite';

const keyFor = (bucket: Bucket, key: string) => `rl:${bucket}:${key.toLowerCase().trim()}`;

/** Number of attempts recorded for `key` that are still inside their window. */
export async function attemptCount(bucket: Bucket, key: string): Promise<number> {
  try {
    return await prisma.verificationCode.count({ where: { email: keyFor(bucket, key), expiresAt: { gt: new Date() } } });
  } catch (err) {
    console.warn('[abuseGuard] count failed:', (err as Error)?.message);
    return 0;
  }
}

/** Records one attempt that counts for `windowMs`. */
export async function recordAttempt(bucket: Bucket, key: string, windowMs: number): Promise<void> {
  const k = keyFor(bucket, key);
  try {
    await prisma.verificationCode.deleteMany({ where: { email: k, expiresAt: { lte: new Date() } } });
    await prisma.verificationCode.create({
      data: { id: `rl_${crypto.randomBytes(9).toString('hex')}`, email: k, code: '-', expiresAt: new Date(Date.now() + windowMs) },
    });
  } catch (err) {
    console.warn('[abuseGuard] record failed:', (err as Error)?.message);
  }
}

/** Clears the attempts for `key` (e.g. after a successful sign-in). */
export async function clearAttempts(bucket: Bucket, key: string): Promise<void> {
  await prisma.verificationCode.deleteMany({ where: { email: keyFor(bucket, key) } }).catch(() => {});
}

/**
 * True when `key` already used `max` attempts in the window; otherwise records this attempt and
 * returns false. One call per action (e.g. per email sent, per AI request).
 */
export async function overLimit(bucket: Bucket, key: string, max: number, windowMs: number): Promise<boolean> {
  if ((await attemptCount(bucket, key)) >= max) return true;
  await recordAttempt(bucket, key, windowMs);
  return false;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
