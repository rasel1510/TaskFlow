/**
 * src/api/webhooks/stripe/route.ts — POST /api/webhooks/stripe
 *
 * Signed Stripe events keep each workspace's plan in step with its subscription:
 *   checkout.session.completed      → unlock Pro, record the first invoice
 *   invoice.paid / payment_succeeded → stay on Pro, record the renewal invoice
 *   invoice.payment_failed           → mark the subscription past due (Stripe retries the card)
 *   customer.subscription.updated    → track active / canceling / past due
 *   customer.subscription.deleted    → move the workspace to the free Basic plan
 *
 * Every handler is idempotent (Stripe may deliver an event more than once).
 */
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  fulfilCheckoutSession,
  invoiceSubscriptionId,
  recordStripeInvoice,
  setWorkspacePlan,
  userForCustomer,
} from '@/lib/billing';

const customerIdOf = (c: string | { id: string } | null | undefined) => (typeof c === 'string' ? c : c?.id ?? null);

async function subscriptionUserId(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return sub.metadata?.userId || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');

  // Without signature verification anyone could POST a fake event and unlock Pro
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured — rejecting event.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const ok = await fulfilCheckoutSession(session);
        console.log(`[Stripe Webhook] ${event.type} ${session.id}: ${ok ? 'Pro unlocked' : 'not fulfilled'}`);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) break; // not a subscription invoice
        const user = await userForCustomer(customerIdOf(invoice.customer), await subscriptionUserId(subId));
        if (!user) {
          console.warn(`[Stripe Webhook] ${event.type}: no FlowSync user for customer ${customerIdOf(invoice.customer)}`);
          break;
        }
        await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'active', stripeCustomerId: customerIdOf(invoice.customer) });
        await recordStripeInvoice(user.id, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (!subId) break;
        const user = await userForCustomer(customerIdOf(invoice.customer), await subscriptionUserId(subId));
        if (user) await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'past_due' });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await userForCustomer(customerIdOf(sub.customer), sub.metadata?.userId);
        if (!user) break;
        if (sub.status === 'active' || sub.status === 'trialing') {
          await setWorkspacePlan(user, 'pro', {
            subscriptionStatus: sub.cancel_at_period_end || sub.cancel_at ? 'canceling' : 'active',
          });
        } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
          await setWorkspacePlan(user, 'pro', { subscriptionStatus: 'past_due' });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await userForCustomer(customerIdOf(sub.customer), sub.metadata?.userId);
        if (user) {
          // Back to the free Basic plan — the workspace keeps working, just without Pro features
          await setWorkspacePlan(user, 'basic', { subscriptionStatus: 'canceled' });
          console.log(`[Stripe Webhook] Subscription ended for user ${user.id} → Basic`);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[Stripe Webhook] Handling ${event.type} failed:`, err);
    // 500 makes Stripe retry the event later
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
