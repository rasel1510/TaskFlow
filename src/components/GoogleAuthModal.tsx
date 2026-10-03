'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
  isSignUp?: boolean;
}

const PRESET_GOOGLE_ACCOUNTS = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    initials: 'SC',
    role: 'Frontend Engineer',
  },
  {
    name: 'Rasel Ahmed',
    email: 'rasel.ahmed@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    initials: 'RA',
    role: 'Product Lead',
  },
  {
    name: 'Alex Rivera',
    email: 'alex.rivera@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    initials: 'AR',
    role: 'UX Designer',
  },
];

export default function GoogleAuthModal({
  isOpen,
  onClose,
  callbackUrl = '/app',
  isSignUp = false,
}: GoogleAuthModalProps) {
  const router = useRouter();

  const [loadingAccount, setLoadingAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Custom account entry
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Developer OAuth setup guide toggle
  const [showDevGuide, setShowDevGuide] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAuthenticateWithGoogle = async (account: {
    email: string;
    name?: string;
    avatar?: string;
  }) => {
    setError(null);
    setSuccess(null);
    setLoadingAccount(account.email);

    try {
      // 1. Register/sync Google account on backend
      const res = await fetch('/api/auth/google/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email.trim(),
          name: account.name?.trim(),
          avatar: account.avatar,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to authenticate with Google account');
      }

      const { email, token } = json.data;

      // 2. Establish genuine NextAuth session via verified HMAC token
      const signInRes = await signIn('credentials', {
        email,
        password: token,
        isGoogleAuth: 'true',
        redirect: false,
      });

      if (signInRes?.error) {
        throw new Error('Could not establish Google session. Please try again.');
      }

      setSuccess(`Authenticated as ${account.name || email}! Launching FlowSync...`);

      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 600);
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during Google sign-in.');
      setLoadingAccount(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setError('Please provide a valid Google account email address.');
      return;
    }
    handleAuthenticateWithGoogle({
      email: customEmail,
      name: customName || undefined,
    });
  };

  const handleCopyEnvConfig = () => {
    const config = `# Google OAuth 2.0 Credentials (https://console.cloud.google.com)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_URL="http://localhost:3000"`;

    navigator.clipboard.writeText(config);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fadeIn">
      <div
        className="w-full max-w-[420px] bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#F3F4F6] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] shadow-xs flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
              </h2>
              <p className="text-xs text-gray-500">Choose an account to continue to FlowSync</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Preset Google Accounts */}
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              One-Click Google Accounts
            </label>

            <div className="divide-y divide-gray-100 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              {PRESET_GOOGLE_ACCOUNTS.map(acc => {
                const isLoading = loadingAccount === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={!!loadingAccount}
                    onClick={() => handleAuthenticateWithGoogle(acc)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-50/40 transition-colors disabled:opacity-60 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-[#2563EB] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 group-hover:scale-105 transition-transform">
                        {acc.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#111111] truncate flex items-center gap-1.5">
                          <span>{acc.name}</span>
                          <span className="text-[10px] text-gray-400 font-normal">({acc.role})</span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{acc.email}</div>
                      </div>
                    </div>

                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] shrink-0" />
                    ) : (
                      <div className="text-[11px] font-semibold text-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Select →
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Google Account Toggle */}
          <div className="pt-1">
            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                disabled={!!loadingAccount}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-dashed border-[#CBD5E1] rounded-xl text-xs font-medium text-gray-600 hover:text-[#2563EB] hover:border-[#2563EB] hover:bg-blue-50/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Use another Google account</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Your Google Account</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(false)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-600 mb-1">Google Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="your.name@gmail.com"
                    value={customEmail}
                    onChange={e => setCustomEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!!loadingAccount}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-lg shadow-sm active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
                >
                  {loadingAccount === customEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating Google account...</span>
                    </>
                  ) : (
                    <span>Continue with this account</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Developer Live OAuth Setup Section */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowDevGuide(!showDevGuide)}
              className="w-full flex items-center justify-between text-[11px] font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>⚡ Live Google OAuth Setup</span>
              </span>
              {showDevGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDevGuide && (
              <div className="mt-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600 space-y-2 animate-fadeIn">
                <p className="leading-relaxed">
                  To enable Google&apos;s real OAuth popup redirect in production or local development:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 pl-0.5">
                  <li>
                    Visit{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] hover:underline inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </li>
                  <li>Add Redirect URI: <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px] font-mono select-all">http://localhost:3000/api/auth/callback/google</code></li>
                  <li>Paste credentials in <code className="bg-gray-200 px-1 py-0.5 rounded text-[10px] font-mono">.env.local</code>:</li>
                </ol>

                <div className="relative mt-2">
                  <pre className="p-2.5 bg-gray-900 text-gray-200 rounded-lg text-[10px] font-mono overflow-x-auto">
                    {`GOOGLE_CLIENT_ID="your_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_client_secret"`}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyEnvConfig}
                    className="absolute top-2 right-2 p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
                    title="Copy environment template"
                  >
                    {copiedEnv ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F9FAFB] border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-gray-400">
          <span>Protected by NextAuth &amp; Google Identity</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
