import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${randomSuffix}`;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  // Always verify the Stripe signature. Without it anyone could POST a fake
  // "checkout.session.completed" event and upgrade any account to Pro.
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured — rejecting event.');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook Error]:', err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

        console.log(`[Stripe Webhook] checkout.session.completed for user: ${userId || customerEmail}`);

        // Find user by metadata ID or email
        // Never fall back to an unfiltered lookup (would match an arbitrary user)
        const user = userId || customerEmail
          ? await prisma.user.findFirst({
              where: userId ? { id: userId } : { email: customerEmail as string },
            })
          : null;

        if (user) {
          // 1. Activate Pro Plan
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: 'pro',
              subscriptionStatus: 'active',
              stripeCustomerId: stripeCustomerId || user.stripeCustomerId,
              failedPaymentAttempts: 0,
            },
          });

          // 2. Record Paid Invoice in Database if not already present
          const existingInvoice = await prisma.invoice.findFirst({
            where: {
              userId: user.id,
              status: 'paid',
              createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60) }, // Last 1 hour
            },
          });

          if (!existingInvoice) {
            const amountTotal = session.amount_total ? session.amount_total / 100 : 20.0;
            const invoiceNumber = (typeof session.invoice === 'string' ? session.invoice : null) || generateInvoiceNumber();

            const custDetails = (session as any).customer_details;
            const custAddress = custDetails?.address;
            const customerName = custDetails?.name || user.name || user.email?.split('@')[0] || 'FlowSync Customer';
            const customerLocation = custAddress
              ? [custAddress.city, custAddress.state, custAddress.country].filter(Boolean).join(', ') || custAddress.country || 'Global'
              : 'Global';

            await prisma.invoice.create({
              data: {
                userId: user.id,
                invoiceNumber,
                amount: amountTotal,
                currency: session.currency || 'usd',
                status: 'paid',
                planName: 'Pro Plan',
                billingCycle: 'monthly',
                paymentMethod: 'stripe',
                last4: '4242',
                brand: 'visa',
                customerName,
                customerEmail: user.email,
                customerLocation,
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const customerEmail = invoice.customer_email;

        console.log(`[Stripe Webhook] invoice.payment_succeeded for customer: ${customerId || customerEmail}`);

        if (customerId || customerEmail) {
          const user = await prisma.user.findFirst({
            where: customerId ? { stripeCustomerId: customerId } : { email: customerEmail! },
          });

          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: 'pro',
                subscriptionStatus: 'active',
                failedPaymentAttempts: 0,
              },
            });

            const invoiceNumber = invoice.number || generateInvoiceNumber();
            const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } });
            if (!existing) {
              const custName = invoice.customer_name || user.name || 'FlowSync Customer';
              const custAddress = invoice.customer_address;
              const customerLocation = custAddress
                ? [custAddress.city, custAddress.state, custAddress.country].filter(Boolean).join(', ') || custAddress.country || 'Global'
                : 'Global';

              await prisma.invoice.create({
                data: {
                  userId: user.id,
                  invoiceNumber,
                  amount: invoice.amount_paid ? invoice.amount_paid / 100 : 20.0,
                  currency: invoice.currency || 'usd',
                  status: 'paid',
                  planName: 'Pro Plan',
                  billingCycle: 'monthly',
                  paymentMethod: 'stripe',
                  last4: '4242',
                  brand: 'visa',
                  customerName: custName,
                  customerEmail: customerEmail || user.email,
                  customerLocation,
                },
              });
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

        if (customerId) {
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId },
          });

          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: 'free',
                subscriptionStatus: 'canceled',
              },
            });
            console.log(`[Stripe Webhook] subscription cancelled for user: ${user.id}`);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe Webhook Processing Error]:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

