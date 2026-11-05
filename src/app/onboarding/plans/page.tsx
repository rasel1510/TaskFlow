'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Check, ArrowLeft, Tag, AlertCircle } from 'lucide-react';

export default function OnboardingPlansPage() {
  const router = useRouter();

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const [basicLoading, setBasicLoading] = useState(false);
  const [proLoading, setProLoading] = useState(false);
  const [proError, setProError] = useState<string | null>(null);

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

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors overflow-hidden">
      
      {/* Ambient background glow in FlowSync Blue */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-blue-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 -right-48 w-[400px] h-[400px] bg-indigo-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Top Header with official FlowSync logo and stepper */}
      <OnboardingHeader currentStep={1} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center">

        {/* Top Back Navigation Link */}
        <div className="w-full max-w-5xl mb-3 sm:mb-4 flex items-center justify-start">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Proceed to Pay & Choose Your Plan
          </h1>
        </div>

        {/* 2 Category Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-4xl mt-10">

          {/* 1. BASIC PLAN CARD */}
          <div className="rounded-3xl border border-blue-100 dark:border-blue-900/40 bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(37,99,235,0.04)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.08)] hover:border-blue-300 dark:hover:border-blue-800 transition-all">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                Basic Plan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Ideal for individuals, solopreneurs, and small startup teams getting organized.
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-950 dark:text-white">$0</span>
                <span className="text-xs font-medium text-slate-500">/ forever</span>
              </div>

              {/* Feature Checklist in FlowSync Blue */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Up to 5 active projects</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Up to 5 team members & collaborators</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Standard Kanban, List & Calendar views</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Realtime task status updates</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Community support</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleSelectBasic}
              disabled={basicLoading || proLoading}
              className="mt-8 w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-blue-200 dark:border-blue-800/80 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-blue-700 dark:text-blue-300 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{basicLoading ? 'Activating...' : 'Select Basic Plan'}</span>
            </button>
          </div>

          {/* 2. PRO PLAN CARD ($20 / month — Direct Stripe Hosted Gateway) */}
          <div className="rounded-3xl border border-blue-100 dark:border-blue-900/40 bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(37,99,235,0.04)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.08)] hover:border-blue-300 dark:hover:border-blue-800 transition-all">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white">
                Pro Plan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                For high-velocity companies requiring unlimited team scale, AI Copilot, and MCP tools.
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-950 dark:text-white">$20</span>
                <span className="text-xs font-medium text-slate-500">/ month</span>
              </div>

              {/* Feature Checklist in FlowSync Blue */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Unlimited projects & sprints</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Unlimited company members & invites</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>AI Copilot autonomous sprint planner</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>FlowSync MCP Server for Claude & Cursor</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Live SSE event streaming & audit logs</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Official tax invoice & Stripe payment protection</span>
                </li>
              </ul>
            </div>

            {/* Pay $20 Primary Button -> Direct Stripe Payment Gateway */}
            <div className="mt-8 space-y-2">
              <button
                type="button"
                onClick={handlePayWithStripe}
                disabled={proLoading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
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
        <div className="w-full max-w-md mx-auto mt-8">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
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

        {/* Bottom Back Button */}
        <div className="w-full max-w-xl mt-8 mb-4 flex items-center justify-center">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 shadow-xs transition-all cursor-pointer group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>
        </div>

      </main>
    </div>
  );
}
