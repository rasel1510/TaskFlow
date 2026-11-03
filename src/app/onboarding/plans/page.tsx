'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Check, Sparkles, ArrowRight, Tag, Shield, Zap, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function OnboardingPlansPage() {
  const router = useRouter();

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const [basicLoading, setBasicLoading] = useState(false);

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
        setPromoError(data.error || 'Invalid promo code. Try FLOWVIP or SUPERVISOR100');
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

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">

        {/* Title & Badge */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
            <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
            <span>Workspace Plans & Pricing</span>
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Proceed to Pay & Choose Your Plan
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Select the plan that fits your company size, or use a promotional code to activate instant workspace access.
          </p>
        </div>

        {/* 2 Category Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-4xl mt-10">

          {/* 1. BASIC PLAN CARD */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.06)] hover:border-blue-200 dark:hover:border-blue-900/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Starter Tier
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white mt-4">
                Basic Plan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Ideal for individuals, solopreneurs, and small startup teams getting organized.
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-950 dark:text-white">$0</span>
                <span className="text-xs font-medium text-slate-500">/ forever</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                  <span>Up to 5 active projects</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                  <span>Up to 5 team members & collaborators</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                  <span>Standard Kanban, List & Calendar views</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                  <span>Realtime task status updates</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                  <span>Community support</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleSelectBasic}
              disabled={basicLoading}
              className="mt-8 w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-200 dark:border-slate-700 hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-slate-900 dark:text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{basicLoading ? 'Activating...' : 'Select Basic Plan'}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. PRO PLAN CARD ($20 / month — Supervisor Specification) */}
          <div className="rounded-3xl border-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col justify-between shadow-[0_20px_50px_rgba(37,99,235,0.14)] relative overflow-hidden ring-1 ring-blue-500/20">
            {/* Top popular ribbon in FlowSync Blue gradient */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black tracking-wider uppercase py-1.5 px-4 rounded-bl-2xl shadow-sm flex items-center gap-1">
              <Sparkles size={11} className="text-blue-200" />
              <span>Recommended by Supervisor</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                  Full Company Scale
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white mt-4 flex items-center gap-2">
                <span>Pro Plan</span>
                <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                For high-velocity companies requiring unlimited team scale, AI Copilot, and MCP tools.
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">$20</span>
                <span className="text-xs font-medium text-slate-500">/ month</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span><strong className="text-slate-950 dark:text-white">Unlimited</strong> projects & sprints</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span><strong className="text-slate-950 dark:text-white">Unlimited</strong> company members & invites</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span><strong className="text-slate-950 dark:text-white">AI Copilot</strong> autonomous sprint planner</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span><strong className="text-slate-950 dark:text-white">FlowSync MCP Server</strong> for Claude & Cursor</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Live SSE event streaming & audit logs</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2.5} />
                  <span>Official tax invoice & Stripe payment protection</span>
                </li>
              </ul>
            </div>

            {/* As noted in supervisor's diagram: "Pay $20" button */}
            <button
              onClick={() => router.push('/onboarding/payment?plan=pro')}
              className="mt-8 w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Pay $20 (Continue with Stripe)</span>
              <ArrowRight size={15} />
            </button>
          </div>

        </div>

        {/* =========================================================================
            PROMO CODE SECTION (Matching diagram: "Insert Promo Code")
            ========================================================================= */}
        <div className="w-full max-w-xl mt-12 p-6 sm:p-7 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-blue-200/70 dark:border-blue-900/40 shadow-[0_10px_30px_rgba(37,99,235,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={16} className="text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-slate-950 dark:text-white">
              Insert Promo Code
            </h4>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            Have an executive partner code, supervisor waiver, or student voucher? Enter it below to unlock Pro access immediately.
          </p>

          <form onSubmit={handleApplyPromo} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="e.g. FLOWVIP or SUPERVISOR100"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={promoLoading || !promoCode.trim()}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-950 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-xs"
            >
              {promoLoading ? 'Checking...' : 'Apply Code'}
            </button>
          </form>

          {promoError && (
            <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle size={13} />
              <span>{promoError}</span>
            </p>
          )}

          {promoSuccess && (
            <p className="mt-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
              <Check size={14} strokeWidth={3} />
              <span>{promoSuccess}</span>
            </p>
          )}

          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span>Valid test codes:</span>
              <button
                type="button"
                onClick={() => setPromoCode('FLOWVIP')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-mono font-semibold underline cursor-pointer"
              >
                FLOWVIP
              </button>
              <span>or</span>
              <button
                type="button"
                onClick={() => setPromoCode('SUPERVISOR100')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-mono font-semibold underline cursor-pointer"
              >
                SUPERVISOR100
              </button>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Free Waiver</span>
          </div>
        </div>

      </main>
    </div>
  );
}
