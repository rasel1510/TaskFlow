'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  FolderGit2,
} from 'lucide-react';

interface InviteData {
  type?: 'project' | 'team';
  token: string;
  email: string;
  role: string;
  teamName?: string;
  teamId?: string;
  projectName?: string;
  projectId?: string;
  projectColor?: string;
  inviterName: string;
  userExists: boolean;
  alreadyInTeam: boolean;
}

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form field: password for new or existing users
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 1. Verify token on mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided. Please check your invitation email link.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function verifyToken() {
      try {
        const res = await fetch(`/api/team/invite/accept?token=${encodeURIComponent(token!)}`);
        const json = await res.json();

        if (!isMounted) return;

        if (!res.ok || !json.success) {
          setError(json.error?.message || 'Invalid or expired invitation link.');
        } else {
          setInviteData(json.data);
          if (json.data.alreadyInTeam) {
            const title = json.data.type === 'project' ? json.data.projectName : json.data.teamName;
            setSuccess(`You are already a member of ${title}!`);
          }
        }
      } catch {
        if (isMounted) setError('Network error verifying invitation. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Handle Accept
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!session?.user && !inviteData?.userExists) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setError('Passwords do not match. Please verify.');
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload: Record<string, string> = { token };
      if (!session?.user && password) {
        payload.password = password;
      }

      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Failed to accept invitation');
        setSubmitting(false);
        return;
      }

      const isProject = inviteData?.type === 'project';
      const entityName = isProject ? inviteData?.projectName : inviteData?.teamName;
      setSuccess(json.message || `Welcome to ${entityName}!`);

      // Determine post-acceptance redirect URL
      const targetQuery = json.data?.onboardingNeeded
        ? `/app?onboarding=true${isProject && json.data?.projectId ? `&projectId=${json.data.projectId}` : ''}`
        : `/app${isProject && json.data?.projectId ? `?projectId=${json.data.projectId}` : ''}`;

      // Auto sign-in if credentials provided
      if (!session?.user && password && inviteData?.email) {
        const signInRes = await signIn('credentials', {
          email: inviteData.email,
          password,
          redirect: false,
        });

        if (!signInRes?.error) {
          router.push(targetQuery);
          router.refresh();
          return;
        }
      }

      // If already logged in, redirect directly
      setTimeout(() => {
        router.push(targetQuery);
        router.refresh();
      }, 1000);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-xs font-medium text-gray-500">Verifying invitation details...</p>
      </div>
    );
  }

  const isProjectInvite = inviteData?.type === 'project';
  const entityTitle = isProjectInvite ? inviteData?.projectName : inviteData?.teamName;
  const isEmailMismatch = Boolean(
    session?.user?.email &&
    inviteData?.email &&
    session.user.email.toLowerCase() !== inviteData.email.toLowerCase()
  );

  return (
    <div className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-xs"
          style={{
            backgroundColor: isProjectInvite ? `${inviteData?.projectColor || '#2563EB'}15` : '#EFF6FF',
            color: inviteData?.projectColor || '#2563EB',
          }}
        >
          {isProjectInvite ? <FolderGit2 className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#111111]">
          Join {entityTitle || 'Workspace'}
        </h1>
        <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
          <strong>{inviteData?.inviterName}</strong> has invited you to collaborate as a{' '}
          <span className="font-semibold text-[#2563EB]">{inviteData?.role || 'Contributor'}</span>.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Invitation Details Card */}
      {inviteData && !success && (
        <form onSubmit={handleAccept} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2 text-xs">
            <div className="flex items-center justify-between text-gray-500">
              <span>Invited Email:</span>
              <span className="font-semibold text-gray-800">{inviteData.email}</span>
            </div>
            <div className="flex items-center justify-between text-gray-500">
              <span>{isProjectInvite ? 'Project:' : 'Company Name:'}</span>
              <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                {isProjectInvite && (
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: inviteData.projectColor || '#2563EB' }}
                  />
                )}
                {entityTitle}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-500">
              <span>Assigned Role:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB]">
                {inviteData.role}
              </span>
            </div>
          </div>

          {/* New User: Set password */}
          {!session?.user && !inviteData.userExists && (
            <div className="space-y-3 pt-1">
              <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-[11.5px] text-blue-900 leading-relaxed">
                Enter the password provided in your invitation email (or create a new password) to activate your account.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter invitation password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Existing User: Enter password */}
          {!session?.user && inviteData.userExists && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-gray-600">
                Please enter the password provided in your invitation email (or your existing account password) to accept this invitation:
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Invitation / Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already logged in */}
          {session?.user && (
            isEmailMismatch ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                <div className="leading-relaxed">
                  You are currently logged in as <strong>{session.user.email}</strong>, but this invitation was sent to <strong>{inviteData?.email}</strong>.
                </div>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: window.location.href })}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    Sign Out & Switch Account
                  </button>
                  <span className="text-[11px] text-amber-700">or open link in an Incognito window</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                Logged in as <strong>{session.user.name || session.user.email}</strong>. Accepting will link your account to <strong>{entityTitle}</strong>.
              </div>
            )
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Joining {isProjectInvite ? 'project...' : 'workspace...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Accept Invitation & Continue</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Redirect button when success */}
      {success && (
        <button
          type="button"
          onClick={() => {
            const redirectUrl = isProjectInvite && inviteData?.projectId
              ? `/app?projectId=${inviteData.projectId}`
              : '/app';
            router.push(redirectUrl);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <span>Go to {isProjectInvite ? 'Project Workspace' : 'Dashboard'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Footer navigation */}
      <div className="text-center pt-2 border-t border-[#E5E7EB]">
        <p className="text-xs text-gray-500">
          Want to use another account?{' '}
          <Link href="/auth/login" className="text-[#2563EB] font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F9FAFB] px-4 py-8">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
            <span>Loading invitation...</span>
          </div>
        }
      >
        <InviteAcceptContent />
      </Suspense>
    </div>
  );
}
