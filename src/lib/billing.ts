/**
 * src/lib/billing.ts
 *
 * Everything FlowSync does with Stripe, in one place, shared by the billing API and the webhook:
 *   - starting Stripe Checkout for the Pro plan (card details never touch FlowSync's servers)
 *   - verifying a finished Checkout Session belongs to the signed-in user before unlocking Pro
 *   - recording Stripe invoices with the real card brand / last 4 (idempotent by invoice number)
 *   - applying a plan to the whole workspace (a company is on one plan)
 *   - turning Stripe errors into short, honest messages while logging the real cause
 */

import type Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { stripe, isStripeTestMode, readEnv, stripeKeyKind } from '@/lib/stripe';

/** The $20/month Pro price in the FlowSync Stripe *test* account — used only with a test key. */
const TEST_MODE_PRO_PRICE = 'price_1UY73F3G3sadP8zGQfn5AR1E';

export function getProPriceId(): string | null {
  const fromEnv = readEnv('STRIPE_PRO_PRICE_ID');
  if (fromEnv) return fromEnv;
  return isStripeTestMode ? TEST_MODE_PRO_PRICE : null;
}

/** Why payments can't run right now (server misconfiguration), or null when they can. */
export function paymentsConfigProblem(): string | null {
  const kind = stripeKeyKind();
  if (kind === 'missing') return 'STRIPE_SECRET_KEY is not set';
  if (kind === 'publishable') return 'STRIPE_SECRET_KEY holds a publishable key (pk_…) — it needs the secret key (sk_…)';
  if (kind === 'malformed') return 'STRIPE_SECRET_KEY is not a valid Stripe secret key';
  if (!getProPriceId()) return 'STRIPE_PRO_PRICE_ID is not set (required with a live key)';
  return null;
}

/**
 * Whether someone may set up a company: Pro (only ever set by a verified Stripe payment — the
 * Checkout return page or a signed webhook) or the free Basic plan they chose. Nothing else counts,
 * so an unsuccessful or cancelled Stripe payment never reaches company setup.
 */
export function hasActivePlan(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'basic';
}

/* ───────────────────────────── errors ───────────────────────────── */

export interface BillingError {
  status: number;
  code: string;
  message: string;
}

const UNAVAILABLE: BillingError = {
  status: 503,
  code: 'PAYMENTS_UNAVAILABLE',
  message: 'Payments are temporarily unavailable. Please try again later or contact support.',
};

/** Maps any Stripe/server error to a safe user-facing message; logs the real cause for operators. */
export function toBillingError(err: unknown, context: string): BillingError {
  const e = err as { type?: string; code?: string; param?: string; message?: string; statusCode?: number };
  console.error(`[billing] ${context} failed:`, e?.type || '', e?.code || '', e?.param || '', e?.message || err);

  switch (e?.type) {
    case 'StripeAuthenticationError':
    case 'StripePermissionError':
      console.error('[billing] → Check STRIPE_SECRET_KEY in the deployment environment.');
      return UNAVAILABLE;
    case 'StripeInvalidRequestError':
      if (e.code === 'resource_missing' && /price|line_items/.test(e.param || '')) {
        console.error('[billing] → STRIPE_PRO_PRICE_ID does not exist in this Stripe account/mode (test vs live).');
        return UNAVAILABLE;
      }
      return { status: 400, code: 'PAYMENT_REQUEST_INVALID', message: 'We couldn’t start the payment. Please try again.' };
    case 'StripeConnectionError':
    case 'StripeAPIError':
    case 'StripeRateLimitError':
      return { status: 503, code: 'STRIPE_UNREACHABLE', message: 'We couldn’t reach Stripe. Please try again in a moment.' };
    default:
      return { status: 500, code: 'PAYMENT_ERROR', message: 'Something went wrong starting the payment. Please try again.' };
  }
}

/* ──────────────────────────── workspace plan ──────────────────────────── */

type Plan = 'free' | 'basic' | 'pro';

/** Puts the user's whole workspace on `plan` (one company, one plan). */
export async function setWorkspacePlan(
  user: { id: string; teamId: string | null },
  plan: Plan,
  extra: { subscriptionStatus?: string; stripeCustomerId?: string | null } = {}
): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      ...(extra.subscriptionStatus ? { subscriptionStatus: extra.subscriptionStatus } : {}),
      ...(extra.stripeCustomerId ? { stripeCustomerId: extra.stripeCustomerId } : {}),
      ...(plan === 'pro' ? { failedPaymentAttempts: 0 } : {}),
    },
  });
  if (user.teamId) {
    await prisma.user.updateMany({
      where: { teamId: user.teamId, id: { not: user.id } },
      data: { plan, ...(extra.subscriptionStatus ? { subscriptionStatus: extra.subscriptionStatus } : {}) },
    });
  }
}

/* ─────────────────────────────── customers ─────────────────────────────── */

/**
 * The user's Stripe customer id — reusing the stored one only if it still exists in this Stripe
 * account (a test-mode id is useless with a live key and vice versa), else finding or creating one.
 */
export async function ensureStripeCustomer(user: {
  id: string;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) {
    try {
      const c = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!('deleted' in c && c.deleted)) return c.id;
    } catch (err) {
      if ((err as { code?: string })?.code !== 'resource_missing') throw err;
    }
  }

  let customerId: string | null = null;
  if (user.email) {
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    customerId = existing.data[0]?.id ?? null;
  }
  if (!customerId) {
    const created = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
      metadata: { userId: user.id },
    });
    customerId = created.id;
  }
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  return customerId;
}

/** Live (not yet ended) Pro subscriptions for a customer. */
export async function liveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  return subs.data.filter(s => ['active', 'trialing', 'past_due'].includes(s.status));
}

/* ─────────────────────────────── checkout ─────────────────────────────── */

export function appBaseUrl(req: Request): string {
  const configured = process.env.APP_URL || process.env.NEXTAUTH_URL;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return configured || 'http://localhost:3000';
}

/** Creates a Stripe Checkout Session for the Pro subscription; returns its hosted URL. */
export async function createProCheckout(opts: {
  user: { id: string; email: string | null; name: string | null; teamId: string | null; stripeCustomerId: string | null };
  baseUrl: string;
  promotionCodeId?: string;
}): Promise<{ url: string; sessionId: string }> {
  const { user, baseUrl, promotionCodeId } = opts;
  const priceId = getProPriceId()!;
  const customer = await ensureStripeCustomer(user);

  // Success returns to the workspace's billing page, or to company setup during onboarding
  const successUrl = user.teamId
    ? `${baseUrl}/app?view=billing&payment_success=true&session_id={CHECKOUT_SESSION_ID}`
    : `${baseUrl}/onboarding/organization?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = user.teamId ? `${baseUrl}/app?view=billing` : `${baseUrl}/onboarding/plans?payment=cancelled`;

  const metadata = { userId: user.id, plan: 'pro' };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    // A 100%-off promotion code completes without asking for a card
    payment_method_collection: 'if_required',
    billing_address_collection: 'auto',
    customer_update: { name: 'auto', address: 'auto' },
    ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : { allow_promotion_codes: true }),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: { metadata },
  });

  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return { url: session.url, sessionId: session.id };
}

/** Finds an active Stripe promotion code by its customer-facing code (case-insensitive). */
export async function findPromotionCode(code: string): Promise<Stripe.PromotionCode | null> {
  const clean = code.trim();
  if (!clean || clean.length > 64) return null;
  const found = await stripe.promotionCodes.list({ code: clean, active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  // Stripe matches codes case-insensitively on checkout, but list() is exact — try upper case too
  if (clean !== clean.toUpperCase()) {
    const upper = await stripe.promotionCodes.list({ code: clean.toUpperCase(), active: true, limit: 1 });
    return upper.data[0] ?? null;
  }
  return null;
}

/* ─────────────────────────────── fulfilment ─────────────────────────────── */

type CardInfo = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null };

function cardFrom(pm: unknown): CardInfo | null {
  const card = (pm as Stripe.PaymentMethod | null)?.card;
  return card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year } : null;
}

/** The card a subscription/customer pays with (null for promo-only subscriptions with no card). */
export async function cardForCustomer(customerId: string, subscriptionId?: string | null): Promise<CardInfo | null> {
  try {
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['default_payment_method'] });
      const c = cardFrom(sub.default_payment_method);
      if (c) return c;
    }
    const cust = await stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] });
    if (!('deleted' in cust && cust.deleted)) {
      const c = cardFrom((cust as Stripe.Customer).invoice_settings?.default_payment_method);
      if (c) return c;
    }
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
    return cardFrom(pms.data[0]);
  } catch (err) {
    console.warn('[billing] card lookup failed:', (err as Error)?.message || err);
    return null;
  }
}

function locationOf(address: Stripe.Address | null | undefined): string {
  if (!address) return 'Global';
  return [address.city, address.state, address.country].filter(Boolean).join(', ') || 'Global';
}

/** Subscription id of an invoice, for both older and newer Stripe API shapes. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const anyInv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  };
  const s = anyInv.parent?.subscription_details?.subscription ?? anyInv.subscription ?? null;
  return typeof s === 'string' ? s : s?.id ?? null;
}

/** Saves a paid Stripe invoice to FlowSync's invoice history (once per Stripe invoice). */
export async function recordStripeInvoice(userId: string, invoiceOrId: Stripe.Invoice | string): Promise<void> {
  const invoice = typeof invoiceOrId === 'string' ? await stripe.invoices.retrieve(invoiceOrId) : invoiceOrId;
  if (invoice.status !== 'paid') return;

  const invoiceNumber = invoice.number || invoice.id!;
  const existing = await prisma.invoice.findUnique({ where: { invoiceNumber }, select: { id: true } });
  if (existing) return;

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const card = customerId ? await cardForCustomer(customerId, invoiceSubscriptionId(invoice)) : null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const amountPaid = (invoice.amount_paid ?? 0) / 100;

  try {
    await prisma.invoice.create({
      data: {
        userId,
        invoiceNumber,
        amount: amountPaid,
        currency: invoice.currency || 'usd',
        status: 'paid',
        planName: amountPaid === 0 ? 'Pro Plan (promotion)' : 'Pro Plan',
        billingCycle: 'monthly',
        paymentMethod: card ? 'card' : amountPaid === 0 ? 'promotion' : 'stripe',
        last4: card?.last4 ?? null,
        brand: card?.brand ?? null,
        pdfUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
        customerName: invoice.customer_name || user?.name || user?.email?.split('@')[0] || 'FlowSync Customer',
        customerEmail: invoice.customer_email || user?.email || null,
        customerLocation: locationOf(invoice.customer_address),
      },
    });
  } catch (err) {
    // Webhook and return-page verification can race; the unique invoice number keeps one row
    if ((err as { code?: string })?.code !== 'P2002') throw err;
  }
}

/**
 * Unlocks Pro for a completed Checkout Session. When `expectedUserId` is given (the return page),
 * the session must belong to that user — a session id from someone else's payment unlocks nothing.
 * Returns true when Pro was (or already is) active because of this session.
 */
export async function fulfilCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string,
  expectedUserId?: string
): Promise<boolean> {
  const session =
    typeof sessionOrId === 'string' ? await stripe.checkout.sessions.retrieve(sessionOrId) : sessionOrId;

  const ownerId = session.client_reference_id || session.metadata?.userId || null;
  if (!ownerId) return false;
  if (expectedUserId && ownerId !== expectedUserId) {
    console.warn(`[billing] Checkout session ${session.id} does not belong to user ${expectedUserId}`);
    return false;
  }
  if (session.mode !== 'subscription' || session.status !== 'complete') return false;
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return false;

  const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, teamId: true } });
  if (!user) return false;

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'active', stripeCustomerId: customerId });

  const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
  if (invoiceId) await recordStripeInvoice(user.id, invoiceId);
  return true;
}

/** Finds the FlowSync user behind a Stripe customer (stored id first, then subscription metadata). */
export async function userForCustomer(
  customerId: string | null | undefined,
  metadataUserId?: string | null
): Promise<{ id: string; teamId: string | null } | null> {
  if (customerId) {
    const byCustomer = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true, teamId: true } });
    if (byCustomer) return byCustomer;
  }
  if (metadataUserId) {
    return prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true, teamId: true } });
  }
  return null;
}

export { invoiceSubscriptionId };
