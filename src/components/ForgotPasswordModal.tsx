'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  KeyRound,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Step = 'email' | 'otp' | 'password' | 'done';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// OTP Input Component — 6 separate digit boxes
// ─────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const handleChange = (index: number, char: string) => {
    const sanitized = char.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? sanitized : d));
    onChange(next.join('').trimEnd().replace(/ /g, ''));
    if (sanitized && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]?.trim()) {
        const next = digits.map((d, i) => (i === index ? ' ' : d));
        onChange(next.join('').trimEnd().replace(/ /g, ''));
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = digits.map((d, i) => (i === index - 1 ? ' ' : d));
        onChange(next.join('').trimEnd().replace(/ /g, ''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
    }
  };

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          id={`otp-digit-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i]?.trim() || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          autoComplete="one-time-code"
          className={`
            w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none
            transition-all duration-150 select-none
            ${digits[i]?.trim()
              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
              : 'border-[#E5E7EB] bg-white text-[#111111]'
            }
            focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/12
            disabled:opacity-50 disabled:cursor-not-allowed
            caret-transparent
          `}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Resend Countdown
// ─────────────────────────────────────────────
function ResendButton({
  onResend,
  disabled,
}: {
  onResend: () => void;
  disabled: boolean;
}) {
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    setCountdown(30);
    setCanResend(false);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    if (!canResend || disabled) return;
    setCountdown(30);
    setCanResend(false);
    onResend();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canResend || disabled}
      className={`
        inline-flex items-center gap-1.5 text-xs font-semibold transition-all
        ${canResend && !disabled
          ? 'text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer'
          : 'text-gray-400 cursor-not-allowed'
        }
      `}
    >
      <RefreshCw className={`w-3 h-3 ${canResend ? '' : 'opacity-50'}`} />
      {canResend ? 'Resend code' : `Resend in ${countdown}s`}
    </button>
  );
}

// ─────────────────────────────────────────────
// Password Strength Indicator
// ─────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Symbol', ok: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              score >= i ? colors[score] : 'bg-[#E5E7EB]'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`text-[10px] font-medium transition-colors ${
                c.ok ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className={`text-[10px] font-semibold ${colors[score].replace('bg-', 'text-')}`}>
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Modal Component
// ─────────────────────────────────────────────
export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Reset on close
  const handleClose = useCallback(() => {
    setStep('email');
    setEmail('');
    setOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setDevCode(null);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // Step 1 — Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) {
        setError(data.message || 'Failed to send reset code. Please try again.');
      } else {
        if (data.devMode && data.previewCode) setDevCode(data.previewCode);
        setStep('otp');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.devMode && data.previewCode) setDevCode(data.previewCode);
    } catch {
      // silent fail for resend
    }
  };

  // Step 2 — Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Please enter all 6 digits of your code'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp, purpose: 'password-reset' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid code. Please try again.');
        setOtp('');
      } else {
        setResetToken(data.resetToken || '');
        setStep('password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to reset password. Please try again.');
      } else {
        setStep('done');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reset password dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[400px] bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] overflow-hidden animate-fadeIn">
        {/* Progress bar */}
        <div className="h-0.5 bg-[#F3F4F6]">
          <div
            className="h-full bg-[#2563EB] transition-all duration-500 ease-out"
            style={{
              width:
                step === 'email' ? '25%' :
                step === 'otp'   ? '50%' :
                step === 'password' ? '75%' :
                '100%',
            }}
          />
        </div>

        <div className="p-6 sm:p-7">
          {/* ── STEP: EMAIL ── */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <KeyRound className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#111111] leading-tight">Forgot password?</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Enter your email and we'll send a 6-digit reset code.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="fp-email" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="fp-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-[#E5E7EB] text-xs font-semibold text-gray-600 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Sending...</span></>
                  ) : (
                    <span>Send Reset Code</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); setOtp(''); }}
                  className="w-8 h-8 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-base font-bold text-[#111111] leading-tight">Check your inbox</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    We sent a 6-digit code to{' '}
                    <span className="font-semibold text-[#111111]">{email}</span>
                  </p>
                </div>
              </div>

              {/* Dev mode notice */}
              {devCode && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Dev mode:</strong> SMTP not configured. Your code is{' '}
                    <code className="font-mono font-bold tracking-widest bg-amber-100 px-1.5 py-0.5 rounded">{devCode}</code>
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <OtpInput value={otp} onChange={setOtp} disabled={loading} />

              <div className="text-center">
                <ResendButton onResend={handleResend} disabled={loading} />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Verifying...</span></>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </form>
          )}

          {/* ── STEP: NEW PASSWORD ── */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#111111] leading-tight">Set new password</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Choose a strong password for your account.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="fp-new-password" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="fp-new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/10 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrength password={newPassword} />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="fp-confirm-password" className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="fp-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-xs text-[#111111] placeholder:text-gray-400 focus:outline-none focus:ring-3 transition-all disabled:opacity-60 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200/50'
                        : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#2563EB]/10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="mt-1 text-[10px] text-red-500 font-medium">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Resetting...</span></>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </form>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="text-center space-y-5 py-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
              <div>
                <h2 className="text-base font-bold text-[#111111]">Password reset!</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Your password has been updated successfully.<br />
                  You can now sign in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-[0.99]"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
