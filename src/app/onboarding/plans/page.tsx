'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Check, Sparkles, ArrowRight, Tag, Shield, Zap, Lock, AlertCircle } from 'lucide-react';

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
        // As in supervisor diagram: proceed to Create Organization Page
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
        // Direct route to Create Organization Page as shown in supervisor diagram
        router.push('/onboarding/organization');
      }, 1000);
    } catch {
      setPromoError('Network error applying promo code. Please try again.');
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0D0E12] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      <OnboardingHeader currentStep={1} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">
        
        {/* Title & Headline */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E44232]/10 text-[#E44232] dark:bg-[#E44232]/20 dark:text-rose-400 border border-[#E44232]/20">
            <Sparkles size={13} />
            <span>Workspace Plans & Pricing</span>
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            Proceed to Pay & Choose Your Plan
          </h1>

          <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
            Select the plan that fits your company size, or use a promotional code to activate instant workspace access.
          </p>
        </div>

        {/* 2 Category Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-4xl mt-10">
          
          {/* 1. BASIC PLAN CARD */}
          <div className="rounded-3xl border border-[#ECE5D8] dark:border-neutral-800 bg-white dark:bg-[#121316] p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  Starter Tier
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white mt-4">
                Basic Plan
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1.5 leading-relaxed">
                Ideal for individuals, solopreneurs, and small startup teams getting organized.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-neutral-950 dark:text-white">$0</span>
                <span className="text-xs font-medium text-neutral-500">/ forever</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>Up to 5 active projects</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>Up to 5 team members & collaborators</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>Standard Kanban, List & Calendar views</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>Realtime task status updates</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>Community support</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleSelectBasic}
              disabled={basicLoading}
              className="mt-8 w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm border-2 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{basicLoading ? 'Activating...' : 'Select Basic Plan'}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. PRO PLAN CARD ($20 / month - Supervisor Specification) */}
          <div className="rounded-3xl border-2 border-[#E44232] bg-white dark:bg-[#15171C] p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
            {/* Top popular ribbon */}
            <div className="absolute top-0 right-0 bg-[#E44232] text-white text-[10px] font-black tracking-wider uppercase py-1 px-4 rounded-bl-xl shadow-xs">
              Recommended by Supervisor
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E44232]/10 text-[#E44232] dark:bg-[#E44232]/20 dark:text-rose-400">
                  Full Company Scale
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 dark:text-white mt-4 flex items-center gap-2">
                <span>Pro Plan</span>
                <Sparkles size={18} className="text-[#E44232]" />
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1.5 leading-relaxed">
                For high-velocity companies requiring unlimited team scale, AI Copilot, and MCP tools.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-[#E44232]">$20</span>
                <span className="text-xs font-medium text-neutral-500">/ month</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-neutral-700 dark:text-neutral-200">
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span><strong>Unlimited</strong> projects & sprints</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span><strong>Unlimited</strong> company members & invites</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span><strong>AI Copilot</strong> autonomous sprint planner</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span><strong>FlowSync MCP Server</strong> for Claude & Cursor</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span>Live SSE event streaming & audit logs</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check size={16} className="text-[#E44232] shrink-0" strokeWidth={2.5} />
                  <span>Official tax invoice & Stripe payment protection</span>
                </li>
              </ul>
            </div>

            {/* As noted in the supervisor's diagram: "Pay $20" button */}
            <button
              onClick={() => router.push('/onboarding/payment?plan=pro')}
              className="mt-8 w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#E44232] hover:bg-[#D0392A] text-white transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Pay $20 (Continue with Stripe)</span>
              <ArrowRight size={15} />
            </button>
          </div>

        </div>

        {/* =========================================================================
            PROMO CODE SECTION (Matching diagram: "Insert Promo Code")
            ========================================================================= */}
        <div className="w-full max-w-xl mt-12 p-6 rounded-2xl bg-white dark:bg-[#121316] border border-[#ECE5D8] dark:border-neutral-800 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={16} className="text-[#E44232]" />
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
              Insert Promo Code
            </h4>
          </div>

          <p className="text-xs text-neutral-500 mb-4">
            Have an executive partner code, supervisor waiver, or student voucher? Enter it below to unlock Pro access immediately.
          </p>

          <form onSubmit={handleApplyPromo} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="e.g. FLOWVIP or SUPERVISOR100"
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#E44232]/30 focus:border-[#E44232]"
            />
            <button
              type="submit"
              disabled={promoLoading || !promoCode.trim()}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#111111] dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {promoLoading ? 'Checking...' : 'Apply Code'}
            </button>
          </form>

          {promoError && (
            <p className="mt-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
              <AlertCircle size={13} />
              <span>{promoError}</span>
            </p>
          )}

          {promoSuccess && (
            <p className="mt-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <Check size={14} strokeWidth={3} />
              <span>{promoSuccess}</span>
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Valid test codes: <code className="text-neutral-700 dark:text-neutral-300 font-mono">FLOWVIP</code> or <code className="text-neutral-700 dark:text-neutral-300 font-mono">SUPERVISOR100</code></span>
            <span>100% Free Waiver</span>
          </div>
        </div>

      </main>
    </div>
  );
}
