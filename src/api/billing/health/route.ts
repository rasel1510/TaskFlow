/**
 * src/api/billing/health/route.ts — GET /api/billing/health  (Super Admin only)
 *
 * Says whether Stripe payments can work on this deployment and, if not, exactly which setting is
 * wrong. It never returns key or secret values — only their kind (test / live / missing …) and
 * the result of a live check against Stripe.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/permissions';
import { stripe, readEnv, stripeKeyKind } from '@/lib/stripe';
import { getProPriceId } from '@/lib/billing';

type Check = { ok: boolean; status: string; fix?: string };

export async function GET() {
  const session = await auth();
  const user = session?.user as { email?: string; role?: string; isSuperAdmin?: boolean } | undefined;
  if (!user || !(user.isSuperAdmin || isSuperAdmin(user))) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const kind = stripeKeyKind();
  const checks: Record<string, Check> = {};

  checks.secretKey =
    kind === 'test' || kind === 'live'
      ? { ok: true, status: `${kind} secret key` }
      : {
          ok: false,
          status: kind,
          fix:
            kind === 'missing'
              ? 'Add STRIPE_SECRET_KEY (Stripe Dashboard → Developers → API keys → Secret key), then redeploy.'
              : kind === 'publishable'
                ? 'STRIPE_SECRET_KEY contains the publishable key (pk_…). Use the secret key (sk_…), then redeploy.'
                : 'STRIPE_SECRET_KEY is not a Stripe secret key. Paste only the sk_… value, then redeploy.',
        };

  // Does Stripe accept the key?
  if (checks.secretKey.ok) {
    try {
      await stripe.balance.retrieve();
      checks.stripeAccepts = { ok: true, status: 'key accepted by Stripe' };
    } catch (err) {
      const e = err as { type?: string; message?: string };
      checks.stripeAccepts = {
        ok: false,
        status: e.type || 'error',
        fix:
          e.type === 'StripeAuthenticationError'
            ? 'Stripe rejected STRIPE_SECRET_KEY (revoked, rolled or mistyped). Copy the current secret key again, then redeploy.'
            : `Stripe could not be reached: ${e.message || 'unknown error'}`,
      };
    }
  }

  // Does the Pro price exist for this key's account and mode?
  const priceId = getProPriceId();
  const priceFromEnv = Boolean(readEnv('STRIPE_PRO_PRICE_ID'));
  if (!priceId) {
    checks.proPrice = {
      ok: false,
      status: 'missing',
      fix: 'Add STRIPE_PRO_PRICE_ID (Stripe → Product catalog → Pro Plan → price id price_…), then redeploy.',
    };
  } else if (checks.stripeAccepts?.ok) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      const good = price.active && price.type === 'recurring';
      checks.proPrice = {
        ok: good,
        status: `${priceFromEnv ? 'from STRIPE_PRO_PRICE_ID' : 'built-in test price'}: ${price.active ? 'active' : 'inactive'}, ${
          price.recurring ? `${(price.unit_amount ?? 0) / 100} ${price.currency.toUpperCase()} / ${price.recurring.interval}` : 'one-time'
        }`,
        ...(good ? {} : { fix: 'The Pro price must be an active monthly recurring price.' }),
      };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      checks.proPrice = {
        ok: false,
        status: e.code || 'error',
        fix:
          e.code === 'resource_missing'
            ? `STRIPE_PRO_PRICE_ID does not exist in this Stripe account for a ${kind} key. Use the price id from the same account and mode (test vs live), then redeploy.`
            : e.message || 'Price check failed',
      };
    }
  }

  checks.webhookSecret = readEnv('STRIPE_WEBHOOK_SECRET')?.startsWith('whsec_')
    ? { ok: true, status: 'set' }
    : {
        ok: false,
        status: readEnv('STRIPE_WEBHOOK_SECRET') ? 'malformed' : 'missing',
        fix: 'Add STRIPE_WEBHOOK_SECRET (Stripe → Developers → Webhooks → your endpoint → Signing secret whsec_…), then redeploy.',
      };

  const ready = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { success: true, data: { paymentsReady: ready, mode: kind, checks } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
