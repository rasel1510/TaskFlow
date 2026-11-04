'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Building2, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const INDUSTRY_OPTIONS = [
  'Software & Technology',
  'Design & Creative Agency',
  'Product & Engineering',
  'Finance & Operations',
  'Healthcare & Life Sciences',
  'Other',
];

function OnboardingOrganizationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('Software & Technology');
  const [size, setSize] = useState('6-20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(true);

  // Navigate back safely
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/onboarding/plans');
    }
  };

  // Verify that user has paid via Stripe before allowing them to set up an organization
  useEffect(() => {
    async function checkSubscription() {
      try {
        const url = sessionId
          ? `/api/billing?session_id=${encodeURIComponent(sessionId)}`
          : '/api/billing';

        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const hasPaid =
            Boolean(json.data?.invoices && json.data.invoices.some((inv: any) => inv.status === 'paid')) ||
            json.data?.plan === 'pro' ||
            json.data?.plan === 'basic' ||
            Boolean(json.data?.hasPaid);

          if (!hasPaid) {
            router.replace('/onboarding/plans');
            return;
          }

          setCheckingPayment(false);
          return;
        }
      } catch (err) {
        console.warn('Billing verification error:', err);
      }
      router.replace('/onboarding/plans');
    }
    checkSubscription();
  }, [router, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || orgName.trim().length < 2) {
      setError('Please insert your company or organization name (at least 2 characters)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/organization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName.trim(),
          industry,
          teamSize: size,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create organization profile.');
        return;
      }

      // Successfully created organization! Redirect to Dashboard (/app)
      router.push('/app');
      router.refresh();
    } catch {
      setError('Network communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingPayment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
          <span className="text-xs font-medium text-slate-500">Verifying payment status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-x-hidden transition-colors">
      <OnboardingHeader currentStep={4} onBack={handleBack} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">
        
        {/* Top Back Navigation Link */}
        <div className="w-full max-w-xl mb-3 flex items-center justify-start">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>
        </div>

        {/* Title */}
        <div className="text-center max-w-lg mx-auto space-y-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center mx-auto mb-3">
            <Building2 size={24} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Create Your Organization
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Set up your company workspace to collaborate on tasks, projects, and milestones.
          </p>
        </div>

        {/* Organization Form Card */}
        <div className="w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#15171C] border border-slate-200 dark:border-slate-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Input Organization Name */}
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                Company / Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation, TechWave Labs"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  disabled={loading || checkingPayment}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-slate-50/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Team Size Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Team Size
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['1-5', '6-20', '21-50', '50+'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSize(val)}
                    disabled={loading || checkingPayment}
                    className={`
                      py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer
                      ${size === val
                        ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-600 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }
                    `}
                  >
                    {val} members
                  </button>
                ))}
              </div>
            </div>

            {/* Industry Custom Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Industry
              </label>
              <Select value={industry} onValueChange={setIndustry} disabled={loading || checkingPayment}>
                <SelectTrigger className="w-full py-3 h-auto px-4 rounded-xl text-sm bg-slate-50/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all shadow-xs">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-1.5 z-50">
                  {INDUSTRY_OPTIONS.map(opt => (
                    <SelectItem
                      key={opt}
                      value={opt}
                      className="rounded-xl py-2.5 pl-8 pr-3 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 focus:bg-blue-50 dark:focus:bg-blue-950/70 focus:text-blue-600 dark:focus:text-blue-400 cursor-pointer transition-colors"
                    >
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons: Back + Go to Dashboard */}
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="py-3.5 px-5 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={loading || !orgName.trim() || checkingPayment}
                className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span>Initializing Workspace & Projects...</span>
                  </>
                ) : (
                  <span>Go to Dashboard</span>
                )}
              </button>
            </div>

          </form>
        </div>

      </main>
    </div>
  );
}

export default function OnboardingOrganizationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F0F6FF] dark:bg-[#0B1120] flex items-center justify-center text-xs font-semibold text-slate-400">
        Loading organization setup...
      </div>
    }>
      <OnboardingOrganizationContent />
    </Suspense>
  );
}
