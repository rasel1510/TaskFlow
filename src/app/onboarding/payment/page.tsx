'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  ArrowRight,
  Check,
  HelpCircle,
  Sparkles,
  Info,
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

  // Fetch current user failed attempts on mount
  useEffect(() => {
    fetch('/api/billing')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const attempts = data.data.failedPaymentAttempts || 0;
          setFailedAttempts(attempts);
          if (attempts >= 5) {
            setIsLockedOut(true);
            setErrorMsg('Security Policy: Maximum payment attempts (5 of 5) reached for this account. Please contact support.');
          }
        }
      })
      .catch(() => { });
  }, []);

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

  // Auto-fill valid Stripe test card
  const handleFillValidCard = () => {
    setCardName('Senior Software Engineer');
    setCardNumber('4242 4242 4242 4242');
    setExpDate('12 / 28');
    setCvc('999');
    setZipCode('94107');
    setErrorMsg(null);
  };

  // Auto-fill test decline card (to test 5-attempt retry limit)
  const handleFillDecliningCard = () => {
    setCardName('Test Decline Card');
    setCardNumber('4000 0000 0000 0002');
    setExpDate('10 / 25');
    setCvc('123');
    setZipCode('10001');
  };

  // Submit payment to Stripe gateway
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    if (!cardNumber || !expDate || !cvc || !cardName) {
      setErrorMsg('Please complete all card details before proceeding.');
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
          setErrorMsg('Security Limit Reached: Maximum of 5 payment attempts exceeded. Please contact support at support@flowsync.app.');
        } else {
          setErrorMsg(
            data.error ||
            `Card declined. Attempt ${nextAttempts} of 5. You have ${5 - nextAttempts} attempts remaining before account security lockout.`
          );
        }
        return;
      }

      // Successful Stripe payment
      const invoiceId = data.data.invoice?.id;
      router.push(`/onboarding/success?invoiceId=${invoiceId || ''}`);
    } catch {
      setErrorMsg('Payment gateway communication error. Please check your network and retry.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0D0E12] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      <OnboardingHeader currentStep={2} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">

        {/* Title */}
        <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#635BFF]/10 text-[#635BFF] dark:text-[#7A73FF] border border-[#635BFF]/20">
            <Lock size={12} />
            <span>Stripe Payment Gateway</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            Complete Your $20 Pro Subscription
          </h1>

          <p className="text-xs sm:text-sm text-neutral-500">
            Securely processed via Stripe. Your card will be charged $20.00 today.
          </p>
        </div>

        {/* 5-Attempt Limit Alert if Failed */}
        {failedAttempts > 0 && (
          <div
            className={`
              w-full max-w-md mb-6 p-4 rounded-2xl border text-xs flex items-start gap-3 transition-all
              ${isLockedOut
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }
            `}
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-bold text-sm">
                {isLockedOut ? 'Payment Limit Reached (5/5)' : `Payment Retry (${failedAttempts}/5)`}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {isLockedOut
                  ? 'As mandated by system policy, users are limited to 5 failed payment attempts. Please contact support or select our Basic Plan.'
                  : `Supervisor Safety Limit: User is allowed up to 5 attempts. You have ${5 - failedAttempts} attempts remaining.`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full max-w-3xl">

          {/* Order Summary (Col 2) */}
          <div className="md:col-span-2 order-2 md:order-1 rounded-2xl bg-white dark:bg-[#121316] border border-[#ECE5D8] dark:border-neutral-800 p-6 flex flex-col justify-between shadow-xs">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-400 mb-3">
                Order Summary
              </h4>

              <div className="space-y-3 text-xs sm:text-sm border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div className="flex justify-between font-semibold text-neutral-900 dark:text-white">
                  <span>FlowSync Pro Plan</span>
                  <span>$20.00</span>
                </div>
                <div className="flex justify-between text-neutral-500 text-xs">
                  <span>Billing Cycle</span>
                  <span>Monthly</span>
                </div>
                <div className="flex justify-between text-neutral-500 text-xs">
                  <span>Tax (0%)</span>
                  <span>$0.00</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-4">
                <span className="text-sm font-bold text-neutral-950 dark:text-white">Total Due</span>
                <span className="text-2xl font-black text-[#E44232]">$20.00</span>
              </div>

              <div className="mt-6 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                <p className="font-semibold text-neutral-700 dark:text-neutral-300">✓ Instant Activation</p>
                <p>✓ Downloadable Tax Invoice</p>
                <p>✓ Cancel anytime with 1 click</p>
              </div>
            </div>

            {/* Quick Testing Bar */}
            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                Testing Tools
              </span>
              <button
                type="button"
                onClick={handleFillValidCard}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors cursor-pointer font-medium"
              >
                Auto-fill Valid Stripe Card (4242...)
              </button>
              <button
                type="button"
                onClick={handleFillDecliningCard}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 transition-colors cursor-pointer font-medium"
              >
                Auto-fill Declining Card (Test 5 Retries)
              </button>
            </div>
          </div>

          {/* Stripe Card Form (Col 3) */}
          <div className="md:col-span-3 order-1 md:order-2 rounded-2xl bg-white dark:bg-[#15171C] border border-[#ECE5D8] dark:border-neutral-800 p-6 sm:p-7 shadow-lg">

            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800 mb-5">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-[#635BFF]" />
                <span className="text-sm font-bold text-neutral-950 dark:text-white">
                  Payment Details
                </span>
              </div>

              {/* Stripe Brand Badges */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#635BFF]">stripe</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono">
                  TEST MODE
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">

              {/* Cardholder Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  disabled={isLockedOut || processing}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              {/* Card Number */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    disabled={isLockedOut || processing}
                    className="w-full pl-3.5 pr-12 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] font-bold text-neutral-400">VISA / MC</span>
                  </div>
                </div>
              </div>

              {/* Expiry & CVC */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Expiration
                  </label>
                  <input
                    type="text"
                    placeholder="MM / YY"
                    value={expDate}
                    onChange={handleExpChange}
                    disabled={isLockedOut || processing}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    CVC / CVV
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="123"
                    value={cvc}
                    onChange={e => setCvc(e.target.value.replace(/\D/g, ''))}
                    disabled={isLockedOut || processing}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                  />
                </div>
              </div>

              {/* ZIP Code */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Postal / ZIP Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 94107"
                  value={zipCode}
                  onChange={e => setZipCode(e.target.value)}
                  disabled={isLockedOut || processing}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/30 focus:border-[#635BFF]"
                />
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Pay Button */}
              <button
                type="submit"
                disabled={processing || isLockedOut}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#635BFF] hover:bg-[#5349EE] disabled:opacity-50 text-white transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 mt-4"
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

              <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 pt-2">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>Encrypted with TLS 1.3 & Stripe PCI Level 1 Certified</span>
              </div>

            </form>

          </div>

        </div>

      </main>
    </div>
  );
}

