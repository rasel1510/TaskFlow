'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ShieldCheck, ArrowLeft } from 'lucide-react';

interface OnboardingHeaderProps {
  currentStep: 1 | 2 | 3 | 4;
  onBack?: () => void;
}

const STEPS = [
  { step: 1, label: 'Select Plan' },
  { step: 2, label: 'Payment (Stripe)' },
  { step: 3, label: 'Confirmation' },
  { step: 4, label: 'Organization' },
];

export default function OnboardingHeader({ currentStep, onBack }: OnboardingHeaderProps) {
  return (
    <header className="w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-blue-100/70 dark:border-slate-800/80 py-3.5 px-4 sm:px-8 sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left Side: Back button + Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group"
            >
              <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          {/* Brand Logo — Exact FlowSync Logo from Landing Page */}
          <Link href="/" aria-label="FlowSync Home" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs group-hover:scale-105 transition-transform duration-200">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50">
                <title>FlowSync Logo</title>
                <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
              </svg>
            </div>
            <span className="font-bold text-2xl text-black tracking-tighter transition-colors dark:text-white">
              FlowSync
            </span>
          </Link>
        </div>

        {/* Multi-step progress indicator in FlowSync Blue */}
        <div className="hidden sm:flex items-center gap-2">
          {STEPS.map((s, idx) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;

            return (
              <React.Fragment key={s.step}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-xs shadow-blue-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }
                    `}
                  >
                    {isCompleted ? <Check size={13} strokeWidth={3} /> : s.step}
                  </div>
                  <span
                    className={`
                      text-xs font-medium transition-colors
                      ${isCurrent ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}
                    `}
                  >
                    {s.label}
                  </span>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`
                      w-6 h-0.5 rounded-full transition-colors
                      ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-blue-200 dark:bg-blue-900/60' : 'bg-slate-200 dark:bg-slate-800'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span className="hidden md:inline">256-bit Encrypted Checkout</span>
        </div>

      </div>
    </header>
  );
}
