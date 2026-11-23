'use client';

/**
 * /invite/accept?token=...[&action=decline]
 *
 * Landing page for invitation emails. Shows who invited you to which project, then:
 *  - new to FlowSync → choose your name and password, join, and land on the project
 *  - existing account → confirm your password (or continue with Google), join, land on the project
 *  - signed in as the invited email → one-click accept
 *  - signed in as someone else → asked to switch accounts
 *  - "Decline" (button or email link) → confirm, inviter is notified
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';

interface InviteInfo {
  type: 'project' | 'team';
  status: string;
  statusMessage?: string | null;
  email: string;
  role: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  organizationName?: string | null;
  teamName?: string;
  inviterName: string;
  inviterEmail?: string | null;
  account?: 'none' | 'password' | 'google';
  userExists: boolean;
  alreadyInTeam: boolean;
  signedInEmail?: string | null;
  signedInMatches?: boolean;
}

type View = 'loading' | 'invalid' | 'closed' | 'form' | 'confirmDecline' | 'declined' | 'joined';

const inputClass =
  'w-full h-10 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[14px] text-[#111111] placeholder-[#9CA3AF] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]';
const primaryBtn =
  'w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';
const secondaryBtn =
  'w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[14px] font-medium text-[#374151] transition-colors disabled:opacity-60 cursor-pointer';

function formatRole(role: string): string {
  if (!role) return 'Member';
  return /[a-z]/.test(role) ? role : role.charAt(0) + role.slice(1).toLowerCase();
}

function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include a letter and a number';
  return null;
}

function InviteAcceptContent() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const wantsDecline = params.get('action') === 'decline';

  const [view, setView] = useState<View>('loading');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError('This invitation link is incomplete. Open the link from your invitation email again.');
      setView('invalid');
      return;
    }
    try {
      const res = await fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || 'This invitation link is not valid.');
        setView('invalid');
        return;
      }
      const data = json.data as InviteInfo;
      setInfo(data);
      if (data.status && data.status !== 'pending') setView('closed');
      else setView(wantsDecline ? 'confirmDecline' : 'form');
    } catch {
      setError('Could not load the invitation. Check your connection and try again.');
      setView('invalid');
    }
  }, [token, wantsDecline]);

  useEffect(() => {
    load();
  }, [load]);

  // After joining, go straight into the app (the project, for project invitations)
  const projectUrl = () =>
    info?.type === 'project' && info.projectId ? `/app?projectId=${encodeURIComponent(info.projectId)}` : '/app';

  const handleAccept = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!info) return;
    setError(null);

    const signedIn = Boolean(info.signedInEmail);
    const creating = !signedIn && info.account === 'none';
    if (creating) {
      if (name.trim().length < 2) return setError('Please enter your full name.');
      const problem = passwordProblem(password);
      if (problem) return setError(`Password: ${problem.toLowerCase()}.`);
      if (password !== confirm) return setError('The two passwords do not match.');
    }
    if (!signedIn && info.account === 'password' && !password) return setError('Enter your FlowSync password.');

    setBusy(true);
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...(creating ? { name: name.trim() } : {}),
          ...(!signedIn ? { password } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const code = json?.error?.code;
        if (code === 'ACCEPTED' || code === 'ALREADY_RESPONDED' || code === 'DECLINED' || code === 'REVOKED' || code === 'EXPIRED') {
          await load();
        }
        setError(json?.error?.message || 'Could not accept the invitation.');
        setBusy(false);
        return;
      }

      setView('joined');

      if (!signedIn) {
        const result = await signIn('credentials', { email: info.email, password, redirect: false });
        if (result?.error) {
          // Joined, but automatic sign-in failed — send them to the login page, then to the project
          window.location.assign(`/auth/login?callbackUrl=${encodeURIComponent(projectUrl())}`);
          return;
        }
      }
      // Full navigation so the app starts with the fresh session
      window.location.assign(projectUrl());
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/invite/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || 'Could not decline the invitation.');
        if (res.status === 409 || res.status === 410) await load();
        return;
      }
      setView('declined');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Rendering ──────────────────────────────────────────────────────────
  const title = info?.type === 'project' ? info?.projectName : info?.teamName;
  const color = info?.projectColor || '#2563EB';

  return (
    <div className="w-full max-w-[440px]">
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="w-7 h-7 rounded-lg bg-[#111111] text-white text-[13px] font-bold flex items-center justify-center">F</span>
        <span className="text-[17px] font-semibold tracking-tight text-[#111111]">FlowSync</span>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] p-6 sm:p-7">
        {view === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-3 text-[13px] text-[rgba(17,17,17,0.55)]">
            <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
            Loading your invitation…
          </div>
        )}

        {view === 'invalid' && (
          <div className="text-center py-4">
            <XCircle className="w-9 h-9 mx-auto text-[#DC2626]" />
            <h1 className="mt-3 text-[17px] font-semibold text-[#111111]">Invitation not available</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[rgba(17,17,17,0.6)]">{error}</p>
            <Link href="/" className="mt-5 inline-block text-[13.5px] font-medium text-[#2563EB] hover:underline">
              Go to FlowSync
            </Link>
          </div>
        )}

        {info && view !== 'loading' && view !== 'invalid' && (
          <>
            {/* Who invited you to what */}
            <div className="text-center">
              <span
                className="inline-flex w-11 h-11 rounded-xl items-center justify-center text-[17px] font-bold"
                style={{ backgroundColor: `${color}1A`, color }}
                aria-hidden="true"
              >
                {(title || 'F').charAt(0).toUpperCase()}
              </span>
              <h1 className="mt-3 text-[19px] font-semibold tracking-tight text-[#111111]">
                {view === 'declined' ? 'Invitation declined' : view === 'joined' ? `Welcome to ${title}` : `Join ${title}`}
              </h1>
              {view !== 'declined' && view !== 'joined' && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[rgba(17,17,17,0.6)]">
                  <span className="font-medium text-[#111111]">{info.inviterName}</span>
                  {info.inviterEmail ? <span> ({info.inviterEmail})</span> : null} invited you to collaborate
                  {info.organizationName ? (
                    <>
                      {' '}
                      at <span className="font-medium text-[#111111]">{info.organizationName}</span>
                    </>
                  ) : null}
                  .
                </p>
              )}
            </div>

            {(view === 'form' || view === 'confirmDecline') && (
              <dl className="mt-5 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0] px-4 py-3 space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[rgba(17,17,17,0.5)]">{info.type === 'project' ? 'Project' : 'Organization'}</dt>
                  <dd className="font-medium text-[#111111] text-right truncate">{title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[rgba(17,17,17,0.5)]">Your role</dt>
                  <dd className="font-medium text-[#111111]">{formatRole(info.role)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[rgba(17,17,17,0.5)]">Invited email</dt>
                  <dd className="font-medium text-[#111111] text-right truncate">{info.email}</dd>
                </div>
              </dl>
            )}

            {error && (view === 'form' || view === 'confirmDecline') && (
              <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[13px] text-[#B91C1C]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Already answered / expired */}
            {view === 'closed' && (
              <div className="mt-5 text-center">
                <p className="text-[13.5px] leading-relaxed text-[rgba(17,17,17,0.6)]">{info.statusMessage}</p>
                {info.status === 'accepted' && info.signedInMatches && info.projectId ? (
                  <a href={projectUrl()} className={`${primaryBtn} mt-5`}>
                    Open {info.projectName} <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <Link href={info.status === 'accepted' ? '/auth/login' : '/'} className={`${secondaryBtn} mt-5`}>
                    {info.status === 'accepted' ? 'Sign in to FlowSync' : 'Go to FlowSync'}
                  </Link>
                )}
              </div>
            )}

            {/* Decline confirmation */}
            {view === 'confirmDecline' && (
              <div className="mt-5 space-y-2.5">
                <p className="text-[13.5px] leading-relaxed text-[rgba(17,17,17,0.65)]">
                  Decline this invitation? {info.inviterName} will be notified. You can still be invited again later.
                </p>
                <button type="button" onClick={handleDecline} disabled={busy} className={`${primaryBtn} !bg-[#DC2626] hover:!bg-[#B91C1C]`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Decline invitation
                </button>
                <button type="button" onClick={() => setView('form')} disabled={busy} className={secondaryBtn}>
                  I want to join instead
                </button>
              </div>
            )}

            {view === 'declined' && (
              <div className="mt-4 text-center">
                <p className="text-[13.5px] leading-relaxed text-[rgba(17,17,17,0.6)]">
                  You declined the invitation to {title}. {info.inviterName} has been notified.
                </p>
                <Link href="/" className={`${secondaryBtn} mt-5`}>
                  Go to FlowSync
                </Link>
              </div>
            )}

            {view === 'joined' && (
              <div className="mt-4 flex flex-col items-center gap-2 text-[13.5px] text-[rgba(17,17,17,0.6)]">
                <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
                Taking you to the project…
              </div>
            )}

            {/* Accept */}
            {view === 'form' && (
              <form onSubmit={handleAccept} className="mt-5 space-y-3.5" noValidate>
                {info.signedInEmail && !info.signedInMatches && (
                  <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[13px] leading-relaxed text-[#92400E]">
                    You&apos;re signed in as <strong>{info.signedInEmail}</strong>, but this invitation is for{' '}
                    <strong>{info.email}</strong>.
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: window.location.href })}
                      className="mt-2 block font-medium text-[#B45309] hover:underline cursor-pointer"
                    >
                      Sign out and continue as {info.email}
                    </button>
                  </div>
                )}

                {info.signedInMatches && (
                  <p className="text-[13px] text-[rgba(17,17,17,0.6)]">
                    Signed in as <span className="font-medium text-[#111111]">{info.signedInEmail}</span>.
                  </p>
                )}

                {!info.signedInEmail && info.account === 'none' && (
                  <>
                    <p className="text-[13px] text-[rgba(17,17,17,0.6)]">
                      Create your FlowSync account to join. You&apos;ll sign in with <span className="font-medium text-[#111111]">{info.email}</span>.
                    </p>
                    <div>
                      <label htmlFor="inv-name" className="block text-[12.5px] font-medium text-[#374151] mb-1.5">
                        Full name
                      </label>
                      <input id="inv-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arif Habib" maxLength={80} className={inputClass} />
                    </div>
                  </>
                )}

                {!info.signedInEmail && info.account !== 'google' && (
                  <div>
                    <label htmlFor="inv-pw" className="block text-[12.5px] font-medium text-[#374151] mb-1.5">
                      {info.account === 'none' ? 'Create a password' : 'Your FlowSync password'}
                    </label>
                    <div className="relative">
                      <input
                        id="inv-pw"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={info.account === 'none' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#111111] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {info.account === 'none' ? (
                      <p className={`mt-1.5 text-[12px] ${password && passwordProblem(password) ? 'text-[#B45309]' : 'text-[rgba(17,17,17,0.45)]'}`}>
                        At least 8 characters, with a letter and a number.
                      </p>
                    ) : (
                      <Link href="/auth/login" className="mt-1.5 inline-block text-[12px] text-[#2563EB] hover:underline">
                        Forgot your password?
                      </Link>
                    )}
                  </div>
                )}

                {!info.signedInEmail && info.account === 'none' && (
                  <div>
                    <label htmlFor="inv-pw2" className="block text-[12.5px] font-medium text-[#374151] mb-1.5">
                      Confirm password
                    </label>
                    <input id="inv-pw2" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
                  </div>
                )}

                {!info.signedInEmail && info.account === 'google' ? (
                  <button type="button" onClick={() => signIn('google', { callbackUrl: window.location.href })} className={secondaryBtn}>
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.4 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
                    </svg>
                    Continue with Google to join
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={busy || Boolean(info.signedInEmail && !info.signedInMatches)}
                    className={primaryBtn}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {info.signedInEmail
                      ? 'Accept invitation'
                      : info.account === 'none'
                        ? 'Create account and join'
                        : 'Sign in and join'}
                  </button>
                )}

                <button type="button" onClick={() => setView('confirmDecline')} disabled={busy} className={secondaryBtn}>
                  Decline
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <p className="mt-5 text-center text-[12px] text-[rgba(17,17,17,0.45)]">
        FlowSync · Project and task management
      </p>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#F9FAFB] px-4 py-10">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-[13px] text-[rgba(17,17,17,0.55)]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
            Loading invitation…
          </div>
        }
      >
        <InviteAcceptContent />
      </Suspense>
    </main>
  );
}
