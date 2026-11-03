'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';

interface OnboardingHeaderProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { step: 1, label: 'Select Plan' },
  { step: 2, label: 'Payment (Stripe)' },
  { step: 3, label: 'Confirmation' },
  { step: 4, label: 'Organization' },
];

export default function OnboardingHeader({ currentStep }: OnboardingHeaderProps) {
  return (
    <header className="w-full bg-[#FAF7F0]/90 dark:bg-[#121316]/90 backdrop-blur-md border-b border-[#ECE5D8] dark:border-neutral-800 py-3.5 px-4 sm:px-8 sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-[#E44232] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7l8-4 8 4-8 4-8-4z" />
              <path d="M4 12l8 4 8-4" />
              <path d="M4 17l8 4 8-4" />
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-tight text-[#111111] dark:text-white">
            flowsync
          </span>
        </Link>

        {/* Multi-step progress indicator */}
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
                          ? 'bg-[#E44232] text-white ring-2 ring-[#E44232]/30'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                      }
                    `}
                  >
                    {isCompleted ? <Check size={13} strokeWidth={3} /> : s.step}
                  </div>
                  <span
                    className={`
                      text-xs font-medium
                      ${isCurrent ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}
                    `}
                  >
                    {s.label}
                  </span>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`
                      w-6 h-0.5 rounded-full transition-colors
                      ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span className="hidden md:inline">256-bit Encrypted Checkout</span>
        </div>

      </div>
    </header>
  );
}

