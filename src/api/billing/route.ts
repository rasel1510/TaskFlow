/**
 * src/api/billing/route.ts
 *
 * GET  /api/billing                 — plan, access and invoice history for the signed-in user
 *      ?session_id=cs_…             — after Stripe Checkout: verify that session (it must belong to
 *                                     this user) and unlock Pro
 * POST /api/billing { action }      — create_checkout_session | apply_promo_code |
 *                                     create_customer_portal_session | downgrade_to_basic |
 *                                     select_basic_plan
 *
 * Card details are only ever entered on Stripe's hosted Checkout page. Pro is unlocked by a
 * verified Checkout Session or a signed Stripe webhook — never by anything the browser claims.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  appBaseUrl,
  createProCheckout,
  ensureStripeCustomer,
  findPromotionCode,
  fulfilCheckoutSession,
  hasActivePlan,
  liveSubscriptions,
  paymentsConfigProblem,
  setWorkspacePlan,
  toBillingError,
} from '@/lib/billing';

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/* -------------------------------------------------------------------------- */
/*                            GET /api/billing                                */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    let user = await prisma.user.findFirst({
      where: session.user.id ? { id: session.user.id } : { email: session.user.email! },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        teamId: true,
        billingCycle: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        failedPaymentAttempts: true,
        hasCompletedOnboarding: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Returning from Stripe Checkout: verify the session (must be this user's) and unlock Pro
    if (sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId) && user.plan !== 'pro') {
      try {
        if (await fulfilCheckoutSession(sessionId, user.id)) {
          const refreshed = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true, name: true, email: true, plan: true, teamId: true, billingCycle: true,
              subscriptionStatus: true, stripeCustomerId: true, failedPaymentAttempts: true,
              hasCompletedOnboarding: true,
              invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
          });
          if (refreshed) user = refreshed;
        }
      } catch (err) {
        toBillingError(err, 'Checkout session verification');
      }
    }

    const isPro = user.plan === 'pro';

    // Free and Basic plan users do not have Stripe billing or invoices
    const mappedInvoices = isPro
      ? (user.invoices || [])
          .filter(inv => inv.status === 'paid')
          .map(inv => ({
            ...inv,
            customerName: (inv as any).customerName || user.name || user.email?.split('@')[0] || 'FlowSync Customer',
            customerLocation: (inv as any).customerLocation || 'Global',
            customerEmail: (inv as any).customerEmail || user.email,
          }))
      : [];

    const latestInvoice = isPro && mappedInvoices.length > 0 ? mappedInvoices[0] : null;

    // The card on file, as recorded from Stripe (none for promotion-only subscriptions)
    const cardInvoice = isPro ? mappedInvoices.find(inv => inv.last4 && inv.brand) : null;
    const paymentMethod = cardInvoice
      ? { brand: cardInvoice.brand as string, last4: cardInvoice.last4 as string, expMonth: null, expYear: null }
      : null;

    const hasPaid = hasActivePlan(user.plan);
    // After Stripe Checkout: did *this* payment go through? ('paid' only when Pro is now active)
    const checkout = sessionId ? (isPro ? 'paid' : 'not_paid') : undefined;

    // App access: paying users, members of a company whose account is paid (team invites), and
    // anyone who has been added to a project (project invites) — invited people never hit the paywall.
    let isProjectMember = false;
    let teamCovered = false;
    if (!hasPaid) {
      const [membershipCount, paidTeammates] = await Promise.all([
        prisma.projectMember.count({ where: { userId: user.id } }),
        user.teamId
          ? prisma.user.count({ where: { teamId: user.teamId, plan: { in: ['pro', 'basic'] } } })
          : Promise.resolve(0),
      ]);
      isProjectMember = membershipCount > 0;
      teamCovered = paidTeammates > 0;
    }
    const hasAccess = hasPaid || teamCovered || isProjectMember;

    return NextResponse.json({
      success: true,
      data: {
        plan: user.plan || 'free',
        hasPaid,
        hasAccess,
        ...(checkout ? { checkout } : {}),
        isProjectMember,
        teamId: user.teamId,
        billingCycle: isPro ? (user.billingCycle || 'monthly') : 'free',
        subscriptionStatus: user.subscriptionStatus || 'active',
        failedPaymentAttempts: user.failedPaymentAttempts || 0,
        hasCompletedOnboarding: Boolean((user.hasCompletedOnboarding && user.teamId) || user.teamId),
        paymentMethod,
        invoices: mappedInvoices,
        latestInvoice,
      },
    });
  } catch (err: any) {
    console.error('GET /api/billing error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                            POST /api/billing                               */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    const user = await prisma.user.findFirst({
      where: session.user.id ? { id: session.user.id } : { email: session.user.email! },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    /* ── Start Stripe Checkout for Pro (optionally with a promotion code) ── */
    if (action === 'create_checkout_session' || action === 'apply_promo_code') {
      if (user.plan === 'pro') {
        return fail(400, 'Your workspace is already on the Pro plan.', { alreadyPro: true });
      }
      const problem = paymentsConfigProblem();
      if (problem) {
        console.error(`[billing] Checkout unavailable: ${problem}`);
        return fail(503, 'Payments are temporarily unavailable. Please try again later or contact support.', {
          code: 'PAYMENTS_UNAVAILABLE',
        });
      }

      try {
        // A promotion code is checked with Stripe first, then applied on the Checkout page
        let promotionCodeId: string | undefined;
        if (action === 'apply_promo_code') {
          const promo = await findPromotionCode(String(body.promoCode || ''));
          if (!promo) return fail(400, 'That promotion code isn’t valid or has expired.', { code: 'INVALID_PROMO' });
          promotionCodeId = promo.id;
        }

        // Never charge twice: if Stripe already has a live subscription, just restore Pro
        const customerId = await ensureStripeCustomer(user);
        if ((await liveSubscriptions(customerId)).length > 0) {
          await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'active', stripeCustomerId: customerId });
          return fail(400, 'Your workspace is already on the Pro plan.', { alreadyPro: true });
        }

        const checkout = await createProCheckout({
          user: { ...user, stripeCustomerId: customerId },
          baseUrl: appBaseUrl(req),
          promotionCodeId,
        });
        return NextResponse.json({ success: true, data: checkout });
      } catch (err) {
        const e = toBillingError(err, 'Create checkout session');
        return fail(e.status, e.message, { code: e.code });
      }
    }

    /* ── Stripe Customer Portal (update card, download invoices, cancel) ── */
    if (action === 'create_customer_portal_session') {
      if (!user.stripeCustomerId) {
        return fail(400, 'There’s no Stripe billing account for this workspace yet.', { code: 'NO_CUSTOMER' });
      }
      try {
        const portal = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: `${appBaseUrl(req)}/app?view=billing`,
        });
        return NextResponse.json({ success: true, data: { url: portal.url } });
      } catch (err) {
        const e = toBillingError(err, 'Create customer portal session');
        return fail(503, 'The billing portal isn’t available right now. Please try again later.', { code: e.code });
      }
    }

    /* ── Downgrade Pro → Basic ────────────────────────────────────────────── */
    if (action === 'downgrade_to_basic') {
      try {
        const subs = user.stripeCustomerId ? await liveSubscriptions(user.stripeCustomerId) : [];
        if (subs.length > 0) {
          // Stop renewal; Pro stays until the end of the paid period, then the webhook moves to Basic
          let periodEnd = 0;
          for (const sub of subs) {
            const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
            const raw = updated as unknown as {
              current_period_end?: number;
              items?: { data?: { current_period_end?: number }[] };
            };
            periodEnd = Math.max(periodEnd, raw.items?.data?.[0]?.current_period_end ?? raw.current_period_end ?? 0);
          }
          await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'canceling' });
          const until = periodEnd
            ? new Date(periodEnd * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : null;
          return NextResponse.json({
            success: true,
            data: {
              plan: 'pro',
              subscriptionStatus: 'canceling',
              cancelAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              message: until
                ? `Your Pro plan won’t renew. You keep Pro until ${until}, then move to Basic.`
                : 'Your Pro plan won’t renew and moves to Basic at the end of the billing period.',
            },
          });
        }

        await setWorkspacePlan(user, 'basic', { subscriptionStatus: 'active' });
        return NextResponse.json({
          success: true,
          data: { plan: 'basic', subscriptionStatus: 'active', message: 'Your workspace is now on the Basic plan.' },
        });
      } catch (err) {
        const e = toBillingError(err, 'Downgrade');
        return fail(e.status, 'We couldn’t change your plan right now. Please try again.', { code: e.code });
      }
    }

    /* ── Choose the free Basic plan during onboarding ─────────────────────── */
    if (action === 'select_basic_plan') {
      if (user.plan === 'pro') return fail(400, 'Your workspace is already on the Pro plan.', { alreadyPro: true });
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { plan: 'basic', subscriptionStatus: 'active', failedPaymentAttempts: 0 },
        select: { plan: true },
      });
      return NextResponse.json({ success: true, data: { plan: updated.plan, message: 'Basic plan selected.' } });
    }

    // Card numbers are never accepted by FlowSync's servers — payments happen on Stripe Checkout
    if (action === 'pay_with_stripe' || action === 'process_payment') {
      return fail(410, 'Please pay on the secure Stripe checkout page.', { code: 'USE_CHECKOUT' });
    }

    return fail(400, 'Invalid billing action');
  } catch (err: any) {
    console.error('POST /api/billing error:', err);
    return fail(500, 'Something went wrong. Please try again.');
  }
}
