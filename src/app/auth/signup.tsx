'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Briefcase,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Role options allowed at signup
// ---------------------------------------------------------------------------
const roles = ['Admin', 'User'];

// ---------------------------------------------------------------------------
// SignupPage — full page component exported as default
// ---------------------------------------------------------------------------
export default function SignupPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'User',
    password: '',
    agreeToTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password strength calculation
  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strengthScore = calculatePasswordStrength(formData.password);

  const getStrengthLabel = (score: number) => {
    if (!formData.password) return '';
    if (score <= 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500';
    if (score === 2) return 'bg-amber-500';
    if (score === 3) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please enter a valid work email');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (!formData.agreeToTerms) {
      setError('You must accept the Terms of Service to continue');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Signup failed. Please try again.');
      }

      setSuccess('Account created successfully! Signing you in...');

      // Automatic sign in via NextAuth credentials
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        setTimeout(() => {
          router.push('/');
        }, 1200);
      } else {
        setTimeout(() => {
          router.push('/auth/login?registered=true');
        }, 1200);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: 'google' | 'github') => {
    setSocialLoading(provider);
    signIn(provider, { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F9FAFB]">
      {/* Left Column: Brand & Value Showcase */}
      <div className="hidden lg:flex lg:w-[48%] bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#1E293B] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle background glow effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#2563EB]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#3B82F6]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path
                d="M9 11l3 3L22 4"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span className="font-bold text-[20px] tracking-tight text-white">TaskFlow</span>
          <span className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/20">
            v2.4
          </span>
        </div>

        {/* Middle Highlight / Interactive Card Preview */}
        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-blue-200 font-medium mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Built for High-Velocity Product Teams
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Manage projects with speed, clarity, and precision.
          </h1>
          <p className="mt-4 text-base text-gray-400 leading-relaxed max-w-lg">
            Join thousands of fast-moving companies unifying their sprint backlogs, kanban boards, and team velocity metrics in one unified hub.
          </p>

          {/* Interactive Mock Card */}
          <div className="mt-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-gray-300">Active Sprint TF-24</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                In Progress
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-blue-500/30 flex items-center justify-center">
                    <Check className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-200">Refactor design token system</span>
                </div>
                <div className="flex -space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-[9px] font-bold flex items-center justify-center text-white">RA</div>
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-[9px] font-bold flex items-center justify-center text-white">SC</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-amber-500/30 flex items-center justify-center">
                    <Check className="w-3 h-3 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-200">NextAuth credentials &amp; SSO hook</span>
                </div>
                <span className="text-[10px] text-amber-300 font-semibold px-1.5 py-0.5 bg-amber-500/20 rounded">
                  Urgent
                </span>
              </div>
            </div>

            {/* Velocity Progress */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
              <span>Sprint Completion</span>
              <span className="font-semibold text-white">78% (18/23 tasks)</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
        </div>

        {/* Bottom Social Proof / Customer Quote */}
        <div className="relative z-10 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center font-bold text-sm text-white">
              ER
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Elena Rostova</p>
              <p className="text-xs text-gray-400">VP of Engineering at FinScale</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-gray-400 italic">
            &ldquo;TaskFlow replaced 4 disparate tracking tools for our team. The kanban speed and clean UX is hands down best-in-class.&rdquo;
          </p>
        </div>
      </div>

      {/* Right Column: Signup Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px] space-y-7">
          {/* Mobile Logo Banner */}
          <div className="flex lg:hidden items-center gap-2.5 justify-center mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path
                  d="M9 11l3 3L22 4"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <span className="font-bold text-xl text-[#111111] tracking-tight">TaskFlow</span>
          </div>

          {/* Form Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-[#111111]">
              Create your account
            </h2>
            <p className="text-sm text-gray-500 mt-1.5">
              Start your 14-day free trial. No credit card required.
            </p>
          </div>

          {/* Social Sign-In Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSocialSignIn('google')}
              disabled={!!socialLoading || loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              Google
            </button>

            <button
              type="button"
              onClick={() => handleSocialSignIn('github')}
              disabled={!!socialLoading || loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60"
            >
              {socialLoading === 'github' ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              ) : (
                <svg className="w-4 h-4 fill-gray-900" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              )}
              GitHub
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E5E7EB] w-full" />
            <span className="bg-[#F9FAFB] px-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium absolute">
              Or with work email
            </span>
          </div>

          {/* Feedback Banners */}
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

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Sarah Chen"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="sarah@company.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Role in Team */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Your Role
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full pl-10 pr-8 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs appearance-none cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {formData.password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Password Strength</span>
                    <span className="font-semibold text-gray-700">
                      {getStrengthLabel(strengthScore)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          idx <= strengthScore ? getStrengthColor(strengthScore) : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Terms and Privacy Agreement */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={e => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-[#2563EB] border-gray-300 rounded focus:ring-[#2563EB] cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer select-none">
                I agree to the{' '}
                <span className="text-[#2563EB] hover:underline">Terms of Service</span> and{' '}
                <span className="text-[#2563EB] hover:underline">Privacy Policy</span>.
              </label>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating your workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="text-center pt-2 border-t border-[#E5E7EB]">
            <p className="text-xs text-gray-500">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-[#2563EB] font-semibold hover:underline ml-1"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
