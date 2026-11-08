'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import ForgotPasswordModal from '@/components/ForgotPasswordModal';

// ---------------------------------------------------------------------------
// LoginForm — uses useSearchParams, must be wrapped in <Suspense>
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const authError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(
    registered ? 'Account created successfully! Please sign in.' : null
  );

  const callback = searchParams.get('callbackUrl');
  const targetUrl = callback && callback !== '/' && !callback.startsWith('/auth') ? callback : '/app';

  const { data: session, status } = useSession();

  // If already authenticated with a valid session, navigate forward according to onboarding status
  React.useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const user = session.user as any;
      if ((user.hasCompletedOnboarding && user.teamId) || user.teamId) {
        router.replace(targetUrl || '/app');
      } else if (user.hasPaid) {
        router.replace('/onboarding/organization');
      } else {
        router.replace('/onboarding/plans');
      }
    }
  }, [status, session, targetUrl, router]);

  // Handle URL errors returned from NextAuth
  React.useEffect(() => {
    if (authError) {
      setError(`Authentication error: ${authError}`);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password: password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid email or password. Please verify and try again.');
        setLoading(false);
        return;
      }

      setSuccess('Authentication successful! Checking account status...');

      try {
        const billingRes = await fetch('/api/billing', { cache: 'no-store' });
        if (billingRes.ok) {
          const billingJson = await billingRes.json();
          const { hasPaid, hasCompletedOnboarding, teamId } = billingJson?.data || {};

          // Rule 1: If user already completed payment and has company -> Directly send to Company Dashboard (/app)
          if ((hasCompletedOnboarding && teamId) || teamId) {
            setSuccess('Redirecting to your company dashboard...');
            setTimeout(() => {
              router.replace(targetUrl || '/app');
              router.refresh();
            }, 400);
            return;
          }

          // Rule 2: If user completed payment but has not created company -> Directly send to Company Creation page
          if (hasPaid && (!hasCompletedOnboarding || !teamId)) {
            setSuccess('Payment confirmed! Redirecting to company setup...');
            setTimeout(() => {
              router.replace('/onboarding/organization');
              router.refresh();
            }, 400);
            return;
          }

          // Rule 3: If user has not completed payment -> Redirect to Payment page
          if (!hasPaid) {
            setSuccess('Payment required. Redirecting to payment options...');
            setTimeout(() => {
              router.replace('/onboarding/plans');
              router.refresh();
            }, 400);
            return;
          }
        }
      } catch (checkErr) {
        console.warn('Billing check error on login:', checkErr);
      }

      // Safe default: send directly to Dashboard
      setTimeout(() => {
        router.replace(targetUrl || '/app');
        router.refresh();
      }, 500);
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      setError('Unable to sign in. Please verify your credentials and try again.');
      setLoading(false);
    }
  };



  return (
    <div className="relative w-full max-w-[420px] bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] space-y-6">
      {/* Close button (Back to Home) */}
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute right-4 top-4 sm:right-5 sm:top-5 rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
      >
        <X className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="sr-only">Back to home</span>
      </Link>

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <h1 className="text-xl font-bold tracking-tight text-[#111111]">
          Welcome back
        </h1>
      </div>



      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span className="leading-relaxed">{success}</span>
        </div>
      )}

      {/* ForgotPasswordModal is rendered at the root so it overlays correctly */}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-[#111111] mb-1.5">
            Work Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[#111111]">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 transition-all shadow-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            className="w-4 h-4 text-[#2563EB] border-gray-300 rounded focus:ring-[#2563EB] cursor-pointer accent-[#2563EB]"
          />
          <label htmlFor="remember" className="text-xs text-gray-600 cursor-pointer select-none">
            Remember this device for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow-md hover:shadow-blue-500/15 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>



      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />

      {/* Switch to Signup */}
      <div className="text-center pt-2 border-t border-[#E5E7EB]">
        <p className="text-xs text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="text-[#2563EB] font-semibold hover:text-[#1D4ED8] hover:underline ml-1"
          >
            Create free account
          </Link>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoginPage — centered full-screen clean white layout
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-4 py-8 relative selection:bg-blue-50 selection:text-[#2563EB]">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
