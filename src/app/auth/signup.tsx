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
  AlertCircle,
  Loader2,
} from 'lucide-react';

const roles = [
  'User',
  'Admin',
];

export default function SignupPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: roles[0],
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Compute simple password strength score (0-4)
  const calculateStrength = (pwd: string): number => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = calculateStrength(formData.password);

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return 'Too short';
    }
  };

  const getStrengthColor = (score: number) => {
    switch (score) {
      case 1:
        return 'bg-red-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-blue-500';
      case 4:
        return 'bg-emerald-500';
      default:
        return 'bg-gray-200';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Please provide your full name');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please provide a valid work email');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!formData.agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong during account creation');
        setLoading(false);
        return;
      }

      setSuccess('Account created! Signing you in...');

      // Auto sign-in with credentials
      const signInRes = await signIn('credentials', {
        email: formData.email.trim(),
        password: formData.password,
        redirect: false,
      });

      if (signInRes?.error) {
        // If auto-signin fails, redirect to login with query param
        router.push('/auth/login?registered=true');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Signup error:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: 'google' | 'github') => {
    setSocialLoading(provider);
    signIn(provider, { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-4 py-8 relative selection:bg-blue-50 selection:text-[#2563EB]">
      <div className="w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
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
            <span className="text-[20px] font-bold tracking-tight text-[#111111]">
              FlowSync
            </span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Create your account
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Start collaborating with high-velocity engineering teams
          </p>
        </div>

        {/* Social Logins */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSocialSignIn('google')}
            disabled={!!socialLoading || loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
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

        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-[#E5E7EB] w-full" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium absolute">
            Or register with email
          </span>
        </div>

        {/* Notifications */}
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
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

      <footer className="mt-8 text-center text-[11px] text-gray-400">
        © {new Date().getFullYear()} FlowSync Inc. All rights reserved.
      </footer>
    </div>
  );
}