import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/* -------------------------------------------------------------------------- */
/*                                CARD HELPERS                                */
/* -------------------------------------------------------------------------- */

function detectCardBrand(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^6(011|5)/.test(clean)) return 'discover';
  return 'card';
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${randomSuffix}`;
}

const VALID_PROMO_CODES = new Set([
  'FLOWVIP',
  'SUPERVISOR100',
  'LAUNCH2026',
  'PROMO20',
  'TASKFLOW100',
  'STRIPE2026',
]);

/* -------------------------------------------------------------------------- */
/*                            GET /api/billing                                */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: session.user.id ? { id: session.user.id } : { email: session.user.email! },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        teamId: true,
        billingCycle: true,
        subscriptionStatus: true,
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

    // Default mock payment method if user has a Pro plan or invoices
    const latestInvoice = user.invoices[0];
    const paymentMethod = {
      brand: latestInvoice?.brand || 'visa',
      last4: latestInvoice?.last4 || '4242',
      expMonth: 12,
      expYear: 2028,
    };

    const hasPaid =
      (user.invoices && user.invoices.some(inv => inv.status === 'paid')) ||
      user.plan === 'pro';

    return NextResponse.json({
      success: true,
      data: {
        plan: user.plan || 'free',
        hasPaid,
        teamId: user.teamId,
        billingCycle: user.billingCycle || 'monthly',
        subscriptionStatus: user.subscriptionStatus || 'active',
        failedPaymentAttempts: user.failedPaymentAttempts || 0,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        paymentMethod,
        invoices: user.invoices,
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

    /* ------------------------------------------------------------------------
       ACTION 1: SELECT BASIC PLAN ($0)
       ------------------------------------------------------------------------ */
    if (action === 'select_basic_plan') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'basic',
          subscriptionStatus: 'active',
          failedPaymentAttempts: 0,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          plan: updated.plan,
          message: 'Basic plan selected successfully.',
        },
      });
    }

    /* ------------------------------------------------------------------------
       ACTION 2: INSERT PROMO CODE (100% DISCOUNT / BYPASS PAYMENT)
       ------------------------------------------------------------------------ */
    if (action === 'apply_promo_code') {
      const code = String(body.promoCode || '').trim().toUpperCase();

      if (!VALID_PROMO_CODES.has(code)) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired promotional code. Try: FLOWVIP or SUPERVISOR100' },
          { status: 400 }
        );
      }

      // Create zero-cost promotional invoice
      const invoice = await prisma.invoice.create({
        data: {
          userId: user.id,
          invoiceNumber: generateInvoiceNumber(),
          amount: 0.0,
          currency: 'usd',
          status: 'paid',
          planName: 'Pro Plan (Promo 100% Off)',
          billingCycle: 'monthly',
          paymentMethod: 'promo_code',
          last4: 'FREE',
          brand: 'promo',
        },
      });

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'pro',
          subscriptionStatus: 'active',
          failedPaymentAttempts: 0,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          plan: updated.plan,
          invoice,
          message: 'Promo code applied successfully! Full Pro features unlocked.',
        },
      });
    }

    /* ------------------------------------------------------------------------
       ACTION 3: PROCESS STRIPE PAYMENT ($20 PRO PLAN)
       ------------------------------------------------------------------------ */
    if (action === 'pay_with_stripe' || action === 'process_payment') {
      const { cardNumber = '', expMonth, expYear, cvc, name, zip, simulateDecline } = body;

      // ─── Enforce Supervisor Mandate: LIMIT TO 5 TIMES FOR THE USER ───
      const currentAttempts = user.failedPaymentAttempts || 0;
      if (currentAttempts >= 5) {
        return NextResponse.json(
          {
            success: false,
            error: 'Maximum payment attempts (5 of 5) exceeded. Please contact support or try a different payment method.',
            attemptsExceeded: true,
            attempts: currentAttempts,
          },
          { status: 403 }
        );
      }

      const cleanNumber = String(cardNumber).replace(/\D/g, '');

      // Simulate failure condition or explicit test decline
      const isDecline =
        simulateDecline === true ||
        cleanNumber.endsWith('0002') || // Stripe standard test decline
        cleanNumber.endsWith('0005') ||
        (cleanNumber.length < 13 && cleanNumber !== '');

      if (isDecline) {
        const nextAttempts = currentAttempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: { failedPaymentAttempts: nextAttempts },
        });

        const remaining = Math.max(0, 5 - nextAttempts);
        return NextResponse.json(
          {
            success: false,
            error: nextAttempts >= 5
              ? 'Your card was declined. Maximum retry limit (5) reached. Please contact support.'
              : `Your card was declined. Please verify your billing information. (${remaining} attempts remaining)`,
            attempts: nextAttempts,
            remainingAttempts: remaining,
            attemptsExceeded: nextAttempts >= 5,
          },
          { status: 400 }
        );
      }

      // Successful Stripe payment execution
      const brand = detectCardBrand(cleanNumber);
      const last4 = cleanNumber.slice(-4) || '4242';
      const invoiceNumber = generateInvoiceNumber();

      const invoice = await prisma.invoice.create({
        data: {
          userId: user.id,
          invoiceNumber,
          amount: 20.0,
          currency: 'usd',
          status: 'paid',
          planName: 'Pro Plan',
          billingCycle: 'monthly',
          paymentMethod: 'card',
          last4,
          brand,
        },
      });

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: 'pro',
          subscriptionStatus: 'active',
          failedPaymentAttempts: 0, // Reset counter on success
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          plan: updated.plan,
          invoice,
          message: 'Payment of $20.00 processed successfully with Stripe.',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid billing action' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/billing error:', err);
    return NextResponse.json(
      { success: false, error: 'Payment processing error. Please try again.' },
      { status: 500 }
    );
  }
}

