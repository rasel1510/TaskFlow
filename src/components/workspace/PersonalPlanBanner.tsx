'use client';

/**
 * Slim banner at the top of the app in a Personal workspace: trial days left (or "trial ended,
 * read-only"), the free-use request status, and the two ways forward — request free use or
 * create a team. Hidden once free use is approved and in companies.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useWorkspaces } from '@/lib/useWorkspaces';

export default function PersonalPlanBanner() {
  const { current, reload } = useWorkspaces();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current || current.kind !== 'personal' || current.state === 'free') return null;

  const requested = current.freeAccess === 'requested';
  const declined = current.freeAccess === 'declined';
  const expired = current.state === 'expired';

  const requestFree = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/free-access', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Couldn’t send your request.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t send your request.');
    } finally {
      setSending(false);
    }
  };

  let message: React.ReactNode;
  if (requested) {
    message = (
      <>
        <span className="font-medium text-[#111111]">Free-use request sent.</span> We’ll let you know once it’s reviewed.
        {!expired && current.daysLeft != null && ` Your trial has ${current.daysLeft} day${current.daysLeft === 1 ? '' : 's'} left.`}
      </>
    );
  } else if (declined) {
    message = (
      <>
        <span className="font-medium text-[#111111]">Free use wasn’t approved.</span>{' '}
        {expired ? 'Your workspace is read-only. Create a team to keep working.' : 'Create a team to keep working after your trial.'}
      </>
    );
  } else if (expired) {
    message = (
      <>
        <span className="font-medium text-[#111111]">Your free trial has ended.</span> Your work is safe and read-only.
      </>
    );
  } else {
    message = (
      <>
        <span className="font-medium text-[#111111]">Personal workspace</span> · {current.daysLeft} day
        {current.daysLeft === 1 ? '' : 's'} left in your free trial.
      </>
    );
  }

  return (
    <div
      role="status"
      className={`shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-6 py-2.5 border-b text-[13px] ${
        expired ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#78350F]' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[rgba(17,17,17,0.65)]'
      }`}
    >
      <p className="flex-1 min-w-0">
        {message}
        {error && <span className="ml-2 text-[#DC2626]">{error}</span>}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {!requested && !declined && (
          <button
            type="button"
            onClick={requestFree}
            disabled={sending}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[12.5px] font-medium text-[#111111] hover:bg-[#F3F4F6] transition-colors duration-100 ease-out disabled:opacity-60 cursor-pointer"
          >
            {sending && <Loader2 size={13} className="animate-spin" />}
            Request free use
          </button>
        )}
        <a
          href="/onboarding/plans"
          className="h-8 px-3 inline-flex items-center rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12.5px] font-medium transition-colors duration-100 ease-out"
        >
          Create a team
        </a>
      </div>
    </div>
  );
}
