'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Check, ArrowLeft, Tag, AlertCircle } from 'lucide-react';

export default function OnboardingPlansPage() {
  const router = useRouter();

  const [verifyingStatus, setVerifyingStatus] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const [basicLoading, setBasicLoading] = useState(false);
  const [proLoading, setProLoading] = useState(false);
  const [proError, setProError] = useState<string | null>(null);

  // If user already paid, prevent paying again: redirect directly to /app or organization setup
  useEffect(() => {
    let isMounted = true;
    async function checkExistingStatus() {
      try {
        const res = await fetch('/api/billing', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const { hasPaid, hasCompletedOnboarding, teamId } = json?.data || {};

          // If already paid AND completed company setup, redirect to Company Billing with Manage Plan open
          if (hasPaid && ((hasCompletedOnboarding && teamId) || teamId)) {
            router.replace('/app?view=billing&manage=true');
            return;
          }

          // If already paid but company setup pending, redirect directly to organization setup
          if (hasPaid && (!hasCompletedOnboarding || !teamId)) {
            router.replace('/onboarding/organization');
            return;
          }
        }
      } catch (err) {
        console.warn('[OnboardingPlans] Status check error:', err);
      } finally {
        if (isMounted) {
          setVerifyingStatus(false);
        }
      }
    }

    checkExistingStatus();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Navigate back safely to previous page (signup or login or home)
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/auth/signup');
    }
  };

  // Handle selecting the Basic Plan ($0)
  const handleSelectBasic = async () => {
    setBasicLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select_basic_plan' }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/onboarding/organization');
      } else {
        router.push('/onboarding/organization');
      }
    } catch {
      router.push('/onboarding/organization');
    } finally {
      setBasicLoading(false);
    }
  };

  // Handle selecting Pro Plan ($20) -> Redirect directly to Stripe Hosted Payment Gateway
  const handlePayWithStripe = async () => {
    setProLoading(true);
    setProError(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_checkout_session' }),
      });

      const data = await res.json();

      if (data.success && data.data?.url) {
        // Send user directly to Stripe Hosted Payment Gateway
        window.location.href = data.data.url;
      } else {
        setProError(data.error || 'Unable to connect to Stripe payment gateway. Please try again.');
        setProLoading(false);
      }
    } catch {
      setProError('Network error connecting to Stripe. Please try again.');
      setProLoading(false);
    }
  };

  // Handle applying Promo Code (100% discount / bypass payment)
  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    setPromoLoading(true);
    setPromoError(null);
    setPromoSuccess(null);

    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_promo_code',
          promoCode: promoCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPromoError(data.error || 'Invalid promotion code. Please verify and try again.');
        return;
      }

      setPromoSuccess(data.data.message || 'Promo code applied! 100% off Pro Plan.');
      setTimeout(() => {
        router.push('/onboarding/organization');
      }, 1000);
    } catch {
      setPromoError('Network error applying promo code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  };

  if (verifyingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Verifying subscription status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50/60 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors overflow-hidden">
      
      {/* Subtle ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[280px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Top Header with official FlowSync logo and stepper */}
      <OnboardingHeader currentStep={1} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">

        {/* Top Back Navigation Link */}
        <div className="w-full max-w-4xl mb-6 flex items-center justify-start">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>
        </div>

        {/* Hero Section — Mobbin Clean Hierarchy */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Choose your plan
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Select the plan that best fits your workflow. Start free or unlock full speed with Pro.
          </p>
        </div>

        {/* 2 Category Plans Grid — Perfectly Balanced Baselines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-4xl items-stretch">

          {/* 1. BASIC PLAN CARD */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-7 sm:p-8 shadow-xs hover:shadow-md transition-all">
            <div className="flex flex-col flex-1">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Basic Plan
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed min-h-[38px]">
                  Ideal for individuals, solopreneurs, and small startup teams getting organized.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white">$0</span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">/ forever</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                  </div>
                  <span>Up to 5 active projects</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                  </div>
                  <span>Up to 5 team members & collaborators</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                  </div>
                  <span>Standard Kanban, List & Calendar views</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                  </div>
                  <span>Realtime task status updates</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                  </div>
                  <span>Community support</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4">
              <button
                onClick={handleSelectBasic}
                disabled={basicLoading || proLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white transition-all cursor-pointer shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-50"
              >
                {basicLoading ? 'Activating...' : 'Select Basic Plan'}
              </button>
            </div>
          </div>

          {/* 2. PRO PLAN CARD ($20 / month — Direct Stripe Hosted Gateway) */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-7 sm:p-8 shadow-xs hover:shadow-md transition-all">
            <div className="flex flex-col flex-1">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Pro Plan
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed min-h-[38px]">
                  For high-velocity companies requiring unlimited team scale, AI Copilot, and MCP tools.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white">$20</span>
                <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">/ month</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1">
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>Unlimited projects & sprints</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>Unlimited company members & invites</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>AI Copilot autonomous sprint planner</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>FlowSync MCP Server for Claude & Cursor</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>Live SSE event streaming & audit logs</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                  </div>
                  <span>Official tax invoice & Stripe payment protection</span>
                </li>
              </ul>
            </div>

            {/* CTA Button -> Direct Stripe Payment Gateway */}
            <div className="mt-8 pt-4 space-y-2">
              <button
                type="button"
                onClick={handlePayWithStripe}
                disabled={proLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-75 text-white transition-all shadow-sm shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                {proLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Stripe Gateway...</span>
                  </>
                ) : (
                  <span>Select Pro Plan</span>
                )}
              </button>

              {proError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium text-center animate-fadeIn">
                  {proError}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Promotion Code Section — Mobbin Checkout Standard */}
        <div className="w-full max-w-md mx-auto mt-10">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2.5">
              <label htmlFor="promo-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <Tag size={13} className="text-slate-400 dark:text-slate-500" />
                <span>Promotion code</span>
              </label>
            </div>

            <form onSubmit={handleApplyPromo} className="flex items-center gap-2">
              <input
                id="promo-input"
                type="text"
                placeholder="Enter code"
                value={promoCode}
                onChange={e => {
                  setPromoCode(e.target.value.toUpperCase());
                  if (promoError) setPromoError(null);
                }}
                className="flex-1 h-10 px-3.5 text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 font-medium tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-950/10 dark:focus:ring-white/10 focus:border-slate-400 dark:focus:border-slate-600 transition-all uppercase"
              />
              <button
                type="submit"
                disabled={promoLoading || !promoCode.trim()}
                className="h-10 px-4 text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl disabled:opacity-40 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                {promoLoading ? 'Applying...' : 'Apply'}
              </button>
            </form>

            {promoError && (
              <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5 animate-fadeIn">
                <AlertCircle size={13} className="shrink-0" />
                <span>{promoError}</span>
              </p>
            )}

            {promoSuccess && (
              <p className="mt-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-fadeIn">
                <Check size={14} strokeWidth={2.5} className="shrink-0" />
                <span>{promoSuccess}</span>
              </p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
