import Stripe from 'stripe';

/**
 * Server-side Stripe client.
 *
 * The secret key must come from the environment — never hard-code a fallback. When it is missing
 * we still construct a client (so imports don't crash the build), but checkout refuses to start
 * and reports "payments unavailable" instead of failing with an obscure Stripe error.
 *
 * The API version is the SDK's default, so request/response shapes match the SDK's types and the
 * webhook payloads Stripe sends.
 */

/**
 * Reads an env value tolerantly: trims spaces/newlines and strips surrounding quotes, which are
 * easy to paste by accident (e.g. copying `"sk_test_…"` from .env.local into a hosting dashboard).
 */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const clean = raw.trim().replace(/^(['"])(.*)\1$/s, '$2').trim();
  return clean || undefined;
}

const apiKey = readEnv('STRIPE_SECRET_KEY');

if (!apiKey) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set — payments are disabled.');
}

export const stripe = new Stripe(apiKey || 'sk_missing_STRIPE_SECRET_KEY', {
  typescript: true,
  maxNetworkRetries: 2,
  appInfo: { name: 'FlowSync' },
});

/** 'missing' | 'test' | 'live' | 'publishable' (wrong key type) | 'malformed' — never the key itself */
export function stripeKeyKind(): 'missing' | 'test' | 'live' | 'publishable' | 'malformed' {
  if (!apiKey) return 'missing';
  if (/^(sk|rk)_test_[A-Za-z0-9]+$/.test(apiKey)) return 'test';
  if (/^(sk|rk)_live_[A-Za-z0-9]+$/.test(apiKey)) return 'live';
  if (/^pk_(test|live)_/.test(apiKey)) return 'publishable';
  return 'malformed';
}

export const isStripeTestMode = stripeKeyKind() === 'test';
