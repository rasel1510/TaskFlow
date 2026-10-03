import crypto from 'crypto';

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'flowsync-secure-nextauth-secret-key-32chars';

/**
 * Returns whether live Google OAuth environment variables are properly set.
 */
export function isGoogleOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  return Boolean(clientId && clientSecret && clientId.trim() !== '' && clientSecret.trim() !== '');
}

/**
 * Generates a short-lived HMAC token (5-minute validity) for verified Google sign-in.
 */
export function createGoogleAuthToken(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`google:${normalizedEmail}:${timestamp}`)
    .digest('hex');

  return `${timestamp}:${signature}`;
}

/**
 * Validates a Google sign-in HMAC token and ensures it has not expired.
 */
export function verifyGoogleAuthToken(email: string, token: string): boolean {
  if (!email || !token || !token.includes(':')) {
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const [timestampStr, providedSignature] = token.split(':');
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    return false;
  }

  // Token valid for 5 minutes (300,000 ms)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`google:${normalizedEmail}:${timestampStr}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}
