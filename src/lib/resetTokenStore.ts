import crypto from 'crypto';

/**
 * Shared in-memory store for password-reset tokens.
 *
 * Uses globalThis so the same Map instance survives Next.js HMR reloads
 * and is shared across all API route module instances in the same process.
 * (Same pattern as the OTP store in src/lib/verification.ts)
 */
interface ResetEntry {
  token: string;
  expiresAt: number; // ms epoch
}

const g = globalThis as unknown as {
  __flowsyncResetTokenStore?: Map<string, ResetEntry>;
};

if (!g.__flowsyncResetTokenStore) {
  g.__flowsyncResetTokenStore = new Map<string, ResetEntry>();
}

const store = g.__flowsyncResetTokenStore;

// TTL: 15 minutes
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Issue a cryptographically-secure single-use reset token for an email.
 * Called after successful OTP verification.
 */
export function issueResetToken(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const token = crypto.randomBytes(24).toString('hex');
  store.set(normalizedEmail, {
    token,
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
  });
  return token;
}

/**
 * Validate and consume a reset token.
 * Returns true if valid; false if missing, mismatched, or expired.
 * The token is always deleted after this call (single-use guarantee).
 */
export function consumeResetToken(email: string, token: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = store.get(normalizedEmail);

  // Always delete — prevents timing-based replay even on failure
  store.delete(normalizedEmail);

  if (!entry) return false;
  if (Date.now() > entry.expiresAt) return false;
  if (entry.token !== token) return false;

  return true;
}
