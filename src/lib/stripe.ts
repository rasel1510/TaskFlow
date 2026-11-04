import Stripe from 'stripe';

const apiKey =
  process.env.STRIPE_SECRET_KEY ||
  'sk_test_51UXdH03G3sadP8zGDE5ewpxOFuWsbQAfwpucSdcDEwXkBtIHS0nvAfwhbx3mDhyiZ6U54BX0346EIUb8rsZjxGKD003cLGQH2h';

export const stripe = new Stripe(apiKey, {
  apiVersion: '2025-01-27.acacia' as any,
  typescript: true,
});










