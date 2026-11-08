'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import {
  CreditCard,
  Lock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function OnboardingPaymentPage() {
  const router = useRouter();

  // Form states
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Execution states
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mandatory Supervisor Constraint: LIMIT TO 5 TIMES FOR THE USER
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  // Fetch current user failed attempts on mount and prevent duplicate payment
  useEffect(() => {
    fetch('/api/billing', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const { hasPaid, hasCompletedOnboarding, teamId, failedPaymentAttempts } = data.data;

          // If already paid and company created, send directly to Dashboard
          if (hasPaid && ((hasCompletedOnboarding && teamId) || teamId)) {
            router.replace('/app');
            return;
          }

          // If already paid, send directly to organization setup
          if (hasPaid) {
            router.replace('/onboarding/organization');
            return;
          }

          const attempts = failedPaymentAttempts || 0;
          setFailedAttempts(attempts);
          if (attempts >= 5) {
            setIsLockedOut(true);
            setErrorMsg('Security Policy: Maximum payment attempts (5 of 5) reached for this account. Please contact support.');
          }
        }
      })
      .catch(() => {});
  }, [router]);

  // Format Card Number input (xxxx xxxx xxxx xxxx)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  // Format Expiry Date (MM / YY)
  const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setExpDate(`${raw.slice(0, 2)} / ${raw.slice(2)}`);
    } else {
      setExpDate(raw);
    }
  };

  // Launch Stripe Hosted Payment Gateway
  const handleRedirectToStripeCheckout = async () => {
    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_checkout_session' }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setErrorMsg(data.error || 'Failed to initialize payment gateway.');
        setProcessing(false);
      }
    } catch {
      setErrorMsg('Network error connecting to payment gateway.');
      setProcessing(false);
    }
  };

  // Submit payment to Stripe gateway direct fallback
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    if (!cardNumber || !expDate || !cvc || !cardName) {
      setErrorMsg('Please complete all payment fields before proceeding.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_with_stripe',
          cardNumber,
          expMonth: expDate.split('/')[0]?.trim(),
          expYear: expDate.split('/')[1]?.trim(),
          cvc,
          name: cardName,
          zip: zipCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const nextAttempts = data.attempts || (failedAttempts + 1);
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 5 || data.attemptsExceeded) {
          setIsLockedOut(true);
          setErrorMsg('Security Policy: Maximum payment attempts (5 of 5) reached. You are now locked out.');
        } else {
          setErrorMsg(data.error || `Payment declined. You have ${5 - nextAttempts} attempts remaining.`);
        }
        return;
      }

      // Success! Move to Confirmation Step (Success Page)
      router.push(`/onboarding/success?invoiceId=${data.data.invoice.id}`);
    } catch {
      setErrorMsg('Network error communicating with payment gateway.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden transition-colors">
      
      {/* Ambient background glow in FlowSync Blue */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[340px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Top Header with step progress indicator */}
      <OnboardingHeader currentStep={2} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">

        {/* Security / Compliance Badge (Pill) */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
            <Lock size={12} className="text-blue-600 dark:text-blue-400" />
            <span>Stripe Payment Gateway</span>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Complete Your Pro Subscription
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Encrypted payment gateway. Billed $20.00 monthly with automatic invoice receipts.
          </p>
        </div>

        {/* 5-Attempt Limit Alert */}
        {failedAttempts > 0 && (
          <div
            className={`
              w-full max-w-2xl mb-6 p-4 rounded-2xl border text-xs flex items-start gap-3 transition-all animate-fadeIn
              ${isLockedOut
                ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }
            `}
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-bold text-sm">
                {isLockedOut ? 'Payment Limit Reached (5 of 5)' : `Card Declined (Attempt ${failedAttempts} of 5)`}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {isLockedOut
                  ? 'As mandated by system policy, users are limited to 5 failed payment attempts. Please contact support or use a promo waiver.'
                  : `Supervisor Security Rule: Maximum 5 attempts allowed. You have ${5 - failedAttempts} attempts remaining.`}
              </p>
            </div>
          </div>
        )}

        {/* Main 2-Column Minimalist Checkout Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8 w-full max-w-3xl items-start">

          {/* Left Column: Order Summary (Col 2) */}
          <div className="md:col-span-2 order-2 md:order-1 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200 dark:border-slate-800 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-4">
            <h2 className="font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Plan Details
            </h2>

            <div className="space-y-3.5 text-xs sm:text-sm border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex justify-between font-semibold text-slate-950 dark:text-white">
                <span>FlowSync Pro</span>
                <span className="font-bold">$20.00</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Billing interval</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Monthly</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Sales tax</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">$0.00</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Due</span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">$20.00</span>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                <span>Instant activation upon payment</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                <span>Cancel anytime from settings</span>
              </div>
            </div>
          </div>

          {/* Right Column: Stripe Payment Form (Col 3) */}
          <div className="md:col-span-3 order-1 md:order-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-[0_10px_30px_rgba(37,99,235,0.05)]">

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <CreditCard size={17} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-slate-950 dark:text-white">
                  Payment Details
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold tracking-tight text-slate-500">stripe</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 font-mono font-semibold">
                  TEST MODE
                </span>
              </div>
            </div>

            {/* Supervisor Primary Action: Send to Stripe Hosted Payment Gateway */}
            <div className="mb-6">
              <button
                type="button"
                onClick={handleRedirectToStripeCheckout}
                disabled={processing || isLockedOut}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Stripe Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Stripe Payment Gateway ($20.00)</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                Or direct card input
              </span>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">

              {/* Cardholder Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  disabled={isLockedOut || processing}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
                />
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    disabled={isLockedOut || processing}
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400">VISA / MC</span>
                  </div>
                </div>
              </div>

              {/* Expiry & CVC */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Expiration
                  </label>
                  <input
                    type="text"
                    placeholder="MM / YY"
                    value={expDate}
                    onChange={handleExpChange}
                    disabled={isLockedOut || processing}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    CVC / CVV
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="123"
                    value={cvc}
                    onChange={e => setCvc(e.target.value.replace(/\D/g, ''))}
                    disabled={isLockedOut || processing}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* ZIP Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Postal / ZIP Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 94107"
                  value={zipCode}
                  onChange={e => setZipCode(e.target.value)}
                  disabled={isLockedOut || processing}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
                />
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 animate-fadeIn">
                  {errorMsg}
                </div>
              )}

              {/* Submit Pay Button */}
              <button
                type="submit"
                disabled={processing || isLockedOut}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-md hover:shadow-lg shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 mt-5"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing with Stripe...</span>
                  </>
                ) : isLockedOut ? (
                  <span>Retry Limit Exceeded (5/5)</span>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Pay $20.00 (Submit Payment)</span>
                  </>
                )}
              </button>
            </form>

          </div>

        </div>

      </main>
    </div>
  );
}
