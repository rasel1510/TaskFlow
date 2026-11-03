'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';
import { Building2, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Users } from 'lucide-react';

export default function OnboardingOrganizationPage() {
  const router = useRouter();

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('Software & Technology');
  const [size, setSize] = useState('6-20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'your-company';

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
        setError(data.error || 'Failed to initialize organization. Please try again.');
        return;
      }

      // Successfully created organization! As per supervisor diagram, redirect to Dashboard (/app)!
      router.push('/app');
      router.refresh();
    } catch {
      setError('Network communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#0D0E12] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      <OnboardingHeader currentStep={4} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center">
        
        {/* Title */}
        <div className="text-center max-w-lg mx-auto space-y-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#E44232]/10 text-[#E44232] flex items-center justify-center mx-auto mb-3">
            <Building2 size={24} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            Create Your Organization
          </h1>

          <p className="text-xs sm:text-sm text-neutral-500">
            Set up your company workspace to collaborate on tasks, projects, and milestones.
          </p>
        </div>

        {/* Organization Form Card */}
        <div className="w-full p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#15171C] border border-[#ECE5D8] dark:border-neutral-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Input Organization Name (Matching diagram: "Insert org name") */}
            <div>
              <label className="block text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1.5">
                Company / Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation, TechWave Labs"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  disabled={loading}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#E44232]/30 focus:border-[#E44232]"
                />
              </div>

              {/* Workspace URL preview */}
              <p className="mt-2 text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
                <span>Workspace URL:</span>
                <span className="text-[#E44232]">flowsync.app/{slugPreview}</span>
              </p>
            </div>

            {/* Team Size Pills */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
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
                          ? 'border-[#E44232] bg-[#E44232]/10 text-[#E44232] shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }
                    `}
                  >
                    {val} members
                  </button>
                ))}
              </div>
            </div>

            {/* Industry Selector */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Industry
              </label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#E44232]/30 focus:border-[#E44232]"
              >
                <option value="Software & Technology">Software & Technology</option>
                <option value="Design & Creative Agency">Design & Creative Agency</option>
                <option value="Product & Engineering">Product & Engineering</option>
                <option value="Finance & Operations">Finance & Operations</option>
                <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                <option value="Other">Other</option>
              </select>
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
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-[#E44232] hover:bg-[#D0392A] disabled:opacity-50 text-white transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Initializing Workspace & Projects...</span>
                  </>
                ) : (
                  <>
                    <span>Launch Organization & Go to Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </main>
    </div>
  );
}

