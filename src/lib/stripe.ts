import Stripe from 'stripe';

// The secret key must come from the environment — never hard-code a fallback.
// When it is missing we still construct a client (so imports don't crash the build),
// but every Stripe call fails with an authentication error instead of silently
// using a shared key.
const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set — Stripe API calls will fail.');
}

export const stripe = new Stripe(apiKey || 'sk_missing_STRIPE_SECRET_KEY', {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
});
