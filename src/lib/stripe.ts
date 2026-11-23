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
const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set — payments are disabled.');
}

export const stripe = new Stripe(apiKey || 'sk_missing_STRIPE_SECRET_KEY', {
  typescript: true,
  maxNetworkRetries: 2,
  appInfo: { name: 'FlowSync' },
});

export const isStripeTestMode = (apiKey || '').startsWith('sk_test_') || (apiKey || '').startsWith('rk_test_');
