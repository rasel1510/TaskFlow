'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  RotateCw,
  Check,
  ChevronDown,
} from 'lucide-react';

const ROLES = ['User', 'Project manager', 'Admin'];

export default function SignupPage() {
  const router = useRouter();

  // Multi-step state: 'form' | 'verify'
  const [step, setStep] = useState<'form' | 'verify'>('form');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES[0],
    agreeToTerms: false,
  });

  // Verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Custom role dropdown state
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setRoleDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setRoleDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first digit box when switching to verify step
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Real-time password strength calculation
  const strengthScore = useMemo(() => {
    const pw = formData.password;
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    return score;
  }, [formData.password]);

  const getStrengthLabel = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return 'Weak';
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

  // Step 1: Submit signup form
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

      if (data.requiresVerification) {
        setStep('verify');
        setResendCooldown(30);
        if (data.previewCode) {
          setDevPreviewCode(data.previewCode);
        }
        setSuccess(data.message || 'Verification code dispatched to your email.');
      } else {
        // Fallback auto sign-in
        await handleAutoSignIn();
      }
    } catch (err: unknown) {
      console.error('Signup error:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle individual digit input changes
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (clean.length > 1) {
      // User pasted or typed multiple digits
      const chars = clean.slice(0, 6).split('');
      chars.forEach((c, i) => {
        newDigits[i] = c;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(chars.length, 5);
      digitInputRefs.current[nextIdx]?.focus();

      if (chars.length === 6) {
        submitOtpVerification(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = clean;
    setOtpDigits(newDigits);

    // Auto-advance to next box if digit entered
    if (clean && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits completed
    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      submitOtpVerification(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    pasted.split('').forEach((char, i) => {
      newDigits[i] = char;
    });
    setOtpDigits(newDigits);

    const nextIdx = Math.min(pasted.length, 5);
    digitInputRefs.current[nextIdx]?.focus();

    if (pasted.length === 6) {
      submitOtpVerification(pasted);
    }
  };

  // Submit OTP Verification
  const submitOtpVerification = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setError(null);
    setVerifying(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          code,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Verification failed. Please check the code.');
        setVerifying(false);
        return;
      }

      setSuccess('Email verified! Launching your workspace...');
      await handleAutoSignIn();
    } catch (err) {
      console.error('OTP verification error:', err);
      setError('Verification network error. Please try again.');
      setVerifying(false);
    }
  };

  // Auto Sign-in Helper
  const handleAutoSignIn = async () => {
    try {
      const signInRes = await signIn('credentials', {
        email: formData.email.trim(),
        password: formData.password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push('/auth/login?verified=true');
      } else {
        router.push('/app');
        router.refresh();
      }
    } catch {
      router.push('/auth/login?verified=true');
    }
  };

  // Resend Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to resend code');
      } else {
        setResendCooldown(30);
        setOtpDigits(['', '', '', '', '', '']);
        digitInputRefs.current[0]?.focus();
        if (data.previewCode) {
          setDevPreviewCode(data.previewCode);
        }
        setSuccess('A fresh 6-digit code has been dispatched to your email.');
      }
    } catch {
      setError('Unable to resend code. Please try again later.');
    } finally {
      setResending(false);
    }
  };



  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-4 py-8 relative selection:bg-blue-50 selection:text-[#2563EB]">
      <div className="relative w-full max-w-[440px] bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] space-y-6">
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

          {step === 'form' ? (
            <h1 className="text-xl font-bold tracking-tight text-[#111111]">
              Create your account
            </h1>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mb-2 mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#111111]">
                Verify your email
              </h1>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                We sent a 6-digit verification code to{' '}
                <span className="font-semibold text-gray-800 break-all">{formData.email}</span>
              </p>
            </>
          )}
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

        {/* ============================================================ */}
        {/* STEP 1: Registration Form                                     */}
        {/* ============================================================ */}
        {step === 'form' && (
          <>


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

              {/* Role Selection */}
              <div className="relative" ref={roleDropdownRef}>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Your Role
                </label>
                {/* Dropdown trigger button */}
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen(prev => !prev)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl text-xs text-[#111111] transition-all shadow-xs cursor-pointer ${roleDropdownOpen
                    ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]'
                    : 'border-[#E5E7EB] hover:border-gray-300'
                    }`}
                >
                  <span className="font-medium text-[#111111]">{formData.role}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-150 shrink-0 ${roleDropdownOpen ? 'rotate-180 text-[#2563EB]' : ''
                      }`}
                  />
                </button>

                {/* Dropdown box - rounded matching the input box */}
                {roleDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                    {ROLES.map(role => {
                      const isSelected = formData.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, role }));
                            setRoleDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${isSelected
                            ? 'bg-blue-50 text-[#2563EB] font-semibold'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                          <span>{role}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[#2563EB] stroke-[2.5]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                          className={`h-1 rounded-full transition-all duration-300 ${idx <= strengthScore ? getStrengthColor(strengthScore) : 'bg-gray-200'
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
                    <span>Sending verification code...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Verification</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* ============================================================ */}
        {/* STEP 2: 6-Digit Email Verification Screen                    */}
        {/* ============================================================ */}
        {step === 'verify' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Developer Preview Code Helper (for testing when live SMTP is offline) */}
            {devPreviewCode && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-1">
                <div className="text-[11px] font-semibold text-blue-900 flex items-center justify-center gap-1.5">
                  <span>🛠️ Dev Mode Active (No live SMTP required)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const digits = devPreviewCode.split('');
                    setOtpDigits(digits);
                    submitOtpVerification(devPreviewCode);
                  }}
                  className="text-xs text-[#2563EB] font-mono font-bold hover:underline cursor-pointer"
                >
                  Click here to auto-fill code: [{devPreviewCode}]
                </button>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-4">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    digitInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(idx, e)}
                  onPaste={handleDigitPaste}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border bg-white text-[#111111] focus:outline-none transition-all shadow-xs ${digit
                    ? 'border-[#2563EB] bg-blue-50/20 ring-2 ring-[#DBEAFE]'
                    : 'border-[#E5E7EB] hover:border-gray-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]'
                    }`}
                  disabled={verifying}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {/* Verification Button */}
            <button
              type="button"
              onClick={() => submitOtpVerification()}
              disabled={verifying || otpDigits.join('').length !== 6}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Verify Email & Enter Workspace</span>
                </>
              )}
            </button>

            {/* Resend and Navigation Options */}
            <div className="flex flex-col items-center gap-3 pt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span>Didn&apos;t receive the code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-semibold text-gray-400">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="font-semibold text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {resending ? (
                      <RotateCw className="w-3 h-3 animate-spin" />
                    ) : (
                      'Resend Code'
                    )}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1 text-[11px] cursor-pointer mt-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Change email address</span>
              </button>
            </div>
          </div>
        )}

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
  );
}