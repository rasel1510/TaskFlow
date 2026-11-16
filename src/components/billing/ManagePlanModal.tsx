'use client';

import React, { useState } from 'react';
import {
  X,
  Check,
  CreditCard,
  ExternalLink,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Gift,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';

interface ManagePlanModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: string;
  billingCycle?: string;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  onSuccess: (newPlan: string) => void;
}

export default function ManagePlanModal({
  open,
  onClose,
  currentPlan,
  billingCycle = 'monthly',
  paymentMethod,
  onSuccess,
}: ManagePlanModalProps) {
  const isPro = currentPlan === 'pro';

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingDowngrade, setLoadingDowngrade] = useState(false);

  // Promo code states
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  // Downgrade confirmation state
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  // General feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  // ─── 1. Action: Upgrade to Pro via Stripe Checkout ───
  const handleUpgradeToPro = async () => {
    setLoadingCheckout(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_checkout_session',
          returnUrl: `${window.location.origin}/app?view=billing&payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/app?view=billing`,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setErrorMsg(data.error || 'Failed to initiate Stripe Checkout. Please try again.');
        setLoadingCheckout(false);
      }
    } catch (err: any) {
      console.error('Stripe Checkout Error:', err);
      setErrorMsg('A connection error occurred. Please try again.');
      setLoadingCheckout(false);
    }
  };

  // ─── 2. Action: Manage Stripe Subscription via Customer Portal ───
  const handleManageStripePortal = async () => {
    setLoadingPortal(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_customer_portal_session',
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setErrorMsg(
          data.error ||
            'Stripe Customer Portal is currently unavailable in test mode. Your active Pro subscription is managed securely.'
        );
        setLoadingPortal(false);
      }
    } catch (err: any) {
      console.error('Customer Portal Error:', err);
      setErrorMsg('Failed to open Stripe Customer Portal. Please try again.');
      setLoadingPortal(false);
    }
  };

  // ─── 3. Action: Downgrade from Pro to Basic ───
  const handleDowngrade = async () => {
    setLoadingDowngrade(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'downgrade_to_basic',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Your workspace has been downgraded to the Basic Plan.');
        setShowDowngradeConfirm(false);
        onSuccess('basic');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(data.error || 'Failed to downgrade plan. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Failed to downgrade plan. Please try again.');
    } finally {
      setLoadingDowngrade(false);
    }
  };

  // ─── 4. Action: Apply 100% Promo Code ───
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
          promoCode: promoCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPromoSuccess('Coupon verified! You have been upgraded to Pro.');
        onSuccess('pro');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setPromoError(data.error || 'Invalid promotional code. Please try FLOWVIP or SUPERVISOR100.');
      }
    } catch (err) {
      setPromoError('Network error while verifying promo code.');
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden my-auto transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Top Header Bar (Mobbin Minimalist Pattern) ─── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
            Manage Plan
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* ─── Alerts / Feedback Banners ─── */}
        {errorMsg && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-semibold underline ml-2 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── Downgrade Confirmation Warning (If Triggered) ─── */}
        {showDowngradeConfirm && (
          <div className="mx-5 sm:mx-6 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Are you sure you want to downgrade to Basic?
                </h4>
                <p className="text-[11.5px] text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                  Your workspace will switch to the Free Basic Plan. Project creation will be limited to 5 projects. Your existing project data will remain safe.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDowngradeConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Keep Pro Plan
              </button>
              <button
                type="button"
                onClick={handleDowngrade}
                disabled={loadingDowngrade}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 transition-colors cursor-pointer shadow-xs"
              >
                {loadingDowngrade && <Loader2 size={12} className="animate-spin" />}
                <span>Confirm Downgrade</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── Side-by-Side Plans Comparison (Mobbin UI Architecture) ─── */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* ═══ CARD 1: Basic Plan ($0) ═══ */}
            <div
              className={`rounded-xl p-5 border flex flex-col justify-between transition-all duration-150 ${
                !isPro
                  ? 'border-blue-600 dark:border-blue-500 bg-slate-50/60 dark:bg-slate-950/50 shadow-xs'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Basic Plan</h3>
                  {!isPro && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Current Plan
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">$0</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">/ forever</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Free for small teams and personal projects.
                  </p>
                </div>

                {/* Features List */}
                <div className="mt-5 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>Up to 5 active projects</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>Kanban, List & Calendar views</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>Unlimited task assignments</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>Community support</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                {!isPro ? (
                  <button
                    disabled
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 cursor-default"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDowngradeConfirm(true)}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
                  >
                    Downgrade to Basic
                  </button>
                )}
              </div>
            </div>

            {/* ═══ CARD 2: Pro Plan ($20 / month) — Highlighted ═══ */}
            <div
              className={`rounded-xl p-5 border-2 relative flex flex-col justify-between transition-all duration-150 ${
                isPro
                  ? 'border-emerald-600 dark:border-emerald-500 bg-white dark:bg-slate-900 shadow-sm'
                  : 'border-[#2563EB] bg-white dark:bg-slate-900 shadow-sm ring-1 ring-blue-600/30'
              }`}
            >
              {/* Floating Pill on Top */}
              <span
                className={`absolute -top-3 right-4 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 ${
                  isPro
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#2563EB] text-white'
                }`}
              >
                {isPro ? (
                  <>
                    <CheckCircle2 size={11} />
                    Current Plan
                  </>
                ) : (
                  'Recommended'
                )}
              </span>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Pro Plan</h3>
                </div>

                <div className="mt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">$20.00</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">/ month</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    For teams that need unlimited projects and full collaboration.
                  </p>
                </div>

                {/* Features List */}
                <div className="mt-5 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-white">Unlimited projects & sprints</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-600 shrink-0" />
                      <span>Unlimited team members & roles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-600 shrink-0" />
                      <span>Custom project permissions</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-600 shrink-0" />
                      <span>Tax-compliant Stripe invoices</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-600 shrink-0" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                {!isPro ? (
                  <button
                    onClick={handleUpgradeToPro}
                    disabled={loadingCheckout}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loadingCheckout ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Redirecting to Stripe...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        <span>Upgrade to Pro — $20/mo</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleManageStripePortal}
                    disabled={loadingPortal}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loadingPortal ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Opening Stripe...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        <span>Manage Stripe Subscription</span>
                        <ExternalLink size={13} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ═══ Promo Code Redemption (Mobbin Minimalist Pattern) ═══ */}
          {!isPro && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              {!showPromo ? (
                <button
                  type="button"
                  onClick={() => setShowPromo(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <Gift size={13} />
                  <span>Have a promo code?</span>
                  <ChevronDown size={13} />
                </button>
              ) : (
                <form onSubmit={handleApplyPromo} className="space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Redeem Promo Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPromo(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. FLOWVIP"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 dark:text-white uppercase placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={promoLoading || !promoCode.trim()}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      {promoLoading && <Loader2 size={12} className="animate-spin" />}
                      <span>Apply</span>
                    </button>
                  </div>

                  {promoError && (
                    <p className="text-[11.5px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                      <AlertTriangle size={12} />
                      <span>{promoError}</span>
                    </p>
                  )}

                  {promoSuccess && (
                    <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 size={12} />
                      <span>{promoSuccess}</span>
                    </p>
                  )}
                </form>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
