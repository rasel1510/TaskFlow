'use client';

/**
 * Platform console → Free-use requests: personal workspaces asking to be used for free.
 * Pending requests first; the Super Admin approves or declines, and can revoke an approval.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface FreeAccessRow {
  teamId: string;
  status: 'requested' | 'approved' | 'declined';
  requestedAt: string | null;
  decidedAt: string | null;
  trialEndsAt: string | null;
  projects: number;
  user: { id: string; name: string; email: string; avatar: string } | null;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const STATUS_STYLE: Record<FreeAccessRow['status'], string> = {
  requested: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  approved: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  declined: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
};
const STATUS_LABEL: Record<FreeAccessRow['status'], string> = { requested: 'Pending', approved: 'Approved', declined: 'Declined' };

export default function FreeAccessRequests({ query = '' }: { query?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<FreeAccessRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/free-access', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Couldn’t load requests.');
      setRows(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load requests.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (row: FreeAccessRow, decision: 'approve' | 'decline' | 'revoke') => {
    setBusy(row.teamId + decision);
    try {
      const res = await fetch('/api/admin/free-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: row.teamId, decision }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Couldn’t save the decision.');
      toast.success(
        decision === 'approve' ? `Free use approved for ${row.user?.name}` : decision === 'decline' ? 'Request declined' : 'Free use revoked'
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save the decision.');
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = (rows ?? []).filter(r => !q || r.user?.name.toLowerCase().includes(q) || r.user?.email.toLowerCase().includes(q));
  const pending = (rows ?? []).filter(r => r.status === 'requested').length;

  return (
    <section className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-white">Free-use requests</h3>
          <p className="mt-0.5 text-[12.5px] text-neutral-500">
            People asking to use their personal workspace for free{pending ? ` · ${pending} pending` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          aria-label="Refresh"
          className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {rows === null ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <p className="px-5 py-10 text-center text-[13px] text-[#DC2626]">{error}</p>
      ) : visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-neutral-500">{q ? 'No requests match your search.' : 'No free-use requests yet.'}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {visible.map(row => (
            <li key={row.teamId} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-[13.5px] font-medium text-neutral-900 dark:text-white">{row.user?.name}</span>
                  <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[row.status]}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                <p className="truncate text-[12.5px] text-neutral-500">
                  {row.user?.email} · requested {fmt(row.requestedAt)} · {row.projects} project{row.projects === 1 ? '' : 's'}
                  {row.status !== 'requested' && row.decidedAt ? ` · decided ${fmt(row.decidedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(row, 'approve')}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12.5px] font-medium disabled:opacity-60 cursor-pointer"
                  >
                    {busy === row.teamId + 'approve' && <Loader2 size={13} className="animate-spin" />}
                    Approve
                  </button>
                )}
                {row.status === 'requested' && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(row, 'decline')}
                    className="h-8 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 cursor-pointer"
                  >
                    Decline
                  </button>
                )}
                {row.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(row, 'revoke')}
                    className="h-8 px-3 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 cursor-pointer"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
