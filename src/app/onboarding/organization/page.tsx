'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Building2, AlertCircle, ChevronDown, Check } from 'lucide-react';

const INDUSTRY_OPTIONS = [
  'Software & Technology',
  'Design & Creative Agency',
  'Product & Engineering',
  'Finance & Operations',
  'Healthcare & Life Sciences',
  'Other',
];

export default function OnboardingOrganizationPage() {
  const router = useRouter();

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('Software & Technology');
  const [industryOpen, setIndustryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState('6-20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(true);

  // Close custom dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIndustryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Verify that user has paid via Stripe before allowing them to set up an organization
  useEffect(() => {
    async function checkSubscription() {
      try {
        const res = await fetch('/api/billing');
        if (res.ok) {
          const json = await res.json();
          const hasPaid =
            (json.data?.invoices && json.data.invoices.length > 0) ||
            json.data?.plan === 'pro';
          if (!hasPaid) {
            router.replace('/onboarding/plans');
            return;
          }
        }
      } catch (err) {
        console.warn('Billing verification error:', err);
      } finally {
        setCheckingPayment(false);
      }
    }
    checkSubscription();
  }, [router]);

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
          size,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.requiresPayment) {
          setError('Payment required: You must complete payment using Stripe before opening your company.');
          setTimeout(() => {
            router.push('/onboarding/plans');
          }, 1800);
          return;
        }
        setError(data.error || 'Failed to initialize organization. Please try again.');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F0F6FF] via-[#F8FAFC] to-[#EFF6FF] dark:from-[#0B1120] dark:via-[#0F172A] dark:to-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans relative overflow-hidden transition-colors">
      <OnboardingHeader currentStep={4} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
        
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
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#15171C] border border-slate-200 dark:border-slate-800 shadow-xl">
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
                  disabled={loading}
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
                    className={`
                      py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer
                      ${
                        size === val
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }
                    `}
                  >
                    {val} members
                  </button>
                ))}
              </div>
            </div>

            {/* Industry Selector - Custom Styled to match main box */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Industry
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIndustryOpen(!industryOpen)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 transition-all cursor-pointer text-left font-medium"
                  aria-haspopup="listbox"
                  aria-expanded={industryOpen}
                >
                  <span>{industry}</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${
                      industryOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  />
                </button>

                {industryOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl bg-white dark:bg-[#15171C] border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 space-y-0.5 animate-in fade-in-0 zoom-in-95 duration-150">
                    {INDUSTRY_OPTIONS.map(opt => {
                      const isSelected = industry === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setIndustry(opt);
                            setIndustryOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer text-left ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 font-medium'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button -> Redirects to Dashboard (/app) */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading || !orgName.trim()}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
