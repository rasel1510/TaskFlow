'use client';

/**
 * Invite someone to a project by email (used at the top of "Add Team Members").
 * Sends a FlowSync invitation email with Accept / Decline buttons and lists pending invitations
 * with Resend / Cancel.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, RotateCw, Send, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

const ROLE_OPTIONS = [
  { value: 'Member', label: 'Member' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'Admin', label: 'Admin' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function roleLabel(role: string): string {
  return /[a-z]/.test(role) ? role : role.charAt(0) + role.slice(1).toLowerCase();
}

export default function InviteByEmail({
  projectId,
  projectName,
  onInvited,
}: {
  projectId: string;
  projectName: string;
  onInvited?: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Member');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setPending((json.data as PendingInvite[]).filter(i => i.status === 'pending'));
      }
    } catch {
      /* the list is a convenience — ignore network errors */
    }
  }, [projectId]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const send = async (targetEmail: string, targetRole: string, opts: { resend?: boolean } = {}) => {
    const res = await fetch(`/api/projects/${projectId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, role: targetRole }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error?.message || (opts.resend ? 'Could not resend the invitation' : 'Could not send the invitation'));
    }
    return json;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const json = await send(target, role);
      toast.success(json.message || `Invitation sent to ${target}`);
      setEmail('');
      await loadPending();
      onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invitation');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (inv: PendingInvite) => {
    setBusyId(inv.id);
    try {
      await send(inv.email, inv.role, { resend: true });
      toast.success(`Invitation resent to ${inv.email}`);
      await loadPending();
      onInvited?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend the invitation');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (inv: PendingInvite) => {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations?inviteId=${encodeURIComponent(inv.id)}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.error?.message || 'Could not cancel the invitation');
      toast.success(`Invitation to ${inv.email} cancelled`);
      setPending(prev => prev.filter(p => p.id !== inv.id));
      onInvited?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel the invitation');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="px-4 sm:px-6 py-4 border-b border-[#F3F4F6] bg-white" aria-labelledby="invite-by-email-title">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-[#2563EB]" />
        <h4 id="invite-by-email-title" className="text-[13.5px] font-semibold text-[#111111]">
          Invite by email
        </h4>
      </div>
      <p className="mt-1 text-[12px] text-[rgba(17,17,17,0.55)]">
        Anyone can join {projectName} — they&apos;ll get a FlowSync email with Accept and Decline buttons.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col sm:flex-row gap-2" noValidate>
        <input
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="name@example.com"
          aria-label="Email address to invite"
          aria-invalid={Boolean(error)}
          className={`flex-1 min-w-0 h-9 px-3 rounded-lg border bg-white text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-2 ${
            error ? 'border-[#DC2626] focus:ring-[#FEE2E2]' : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#DBEAFE]'
          }`}
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            aria-label="Role in the project"
            className="h-9 px-2 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#111111] outline-none cursor-pointer hover:border-[#D1D5DB] focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#DBEAFE]"
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-[#DC2626]">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[rgba(17,17,17,0.45)]">
            Pending invitations ({pending.length})
          </p>
          <ul className="mt-1.5 divide-y divide-[#F3F4F6] rounded-lg border border-[#F0F0F0]">
            {pending.map(inv => (
              <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[#111111]">{inv.email}</p>
                  <p className="text-[11.5px] text-[rgba(17,17,17,0.45)]">
                    {roleLabel(inv.role)} · sent {timeAgo(inv.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResend(inv)}
                  disabled={busyId === inv.id}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors disabled:opacity-50 cursor-pointer"
                  title="Send the invitation email again"
                >
                  {busyId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                  Resend
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(inv)}
                  disabled={busyId === inv.id}
                  aria-label={`Cancel invitation to ${inv.email}`}
                  title="Cancel invitation"
                  className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
