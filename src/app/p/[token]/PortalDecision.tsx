'use client';

import { useState } from 'react';

/** Approve / decline buttons for an estimated change request on the client portal. */
export default function PortalDecision({ token, changeRequestId }: { token: string; changeRequestId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'approved' | 'rejected' | 'error'>('idle');
  const decide = async (decision: 'approved' | 'rejected') => {
    setState('busy');
    try {
      const res = await fetch('/api/public/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, changeRequestId, decision }),
      });
      setState(res.ok ? decision : 'error');
    } catch {
      setState('error');
    }
  };
  if (state === 'approved') return <span className="text-[12.5px] text-emerald-700 shrink-0">Approved — thank you</span>;
  if (state === 'rejected') return <span className="text-[12.5px] text-neutral-500 shrink-0">Declined</span>;
  return (
    <div className="flex gap-2 shrink-0">
      <button type="button" disabled={state === 'busy'} onClick={() => decide('rejected')} className="h-8 px-3 rounded-lg border border-neutral-200 text-[13px] hover:bg-neutral-50 cursor-pointer disabled:opacity-50">
        Decline
      </button>
      <button type="button" disabled={state === 'busy'} onClick={() => decide('approved')} className="h-8 px-3 rounded-lg bg-[#2563EB] text-white text-[13px] hover:bg-[#1D4ED8] cursor-pointer disabled:opacity-50">
        Approve
      </button>
      {state === 'error' && <span className="text-[12px] text-red-600 self-center">Try again</span>}
    </div>
  );
}
