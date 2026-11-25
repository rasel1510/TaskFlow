import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Password-reset tokens, stored in the database (works across every server instance).
 *
 * A token is issued only after the emailed 6-digit code is verified. Only a SHA-256 hash of the
 * token is stored (row key "reset:<email>" in VerificationCode); it is single-use and expires
 * after 15 minutes.
 */

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const keyFor = (email: string) => `reset:${email.toLowerCase().trim()}`;
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Issue a cryptographically secure single-use reset token for an email. */
export async function issueResetToken(email: string): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex');
  const key = keyFor(email);
  await prisma.verificationCode.deleteMany({ where: { email: key } });
  await prisma.verificationCode.create({
    data: {
      id: `reset_${crypto.randomBytes(9).toString('hex')}`,
      email: key,
      code: hash(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return token;
}

/**
 * Validate and consume a reset token. Returns true only if it matches and has not expired.
 * The stored token is always deleted (single-use, even on failure).
 */
export async function consumeResetToken(email: string, token: string): Promise<boolean> {
  const key = keyFor(email);
  const row = await prisma.verificationCode.findFirst({ where: { email: key }, orderBy: { createdAt: 'desc' } });
  await prisma.verificationCode.deleteMany({ where: { email: key } });
  if (!row || !token || row.expiresAt.getTime() < Date.now()) return false;
  const a = Buffer.from(row.code);
  const b = Buffer.from(hash(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
