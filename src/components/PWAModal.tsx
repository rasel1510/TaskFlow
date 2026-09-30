'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  X,
  CheckCircle2,
  Share,
  PlusSquare,
  MoreVertical,
  ExternalLink,
  Smartphone,
  Laptop,
  Sparkles,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

interface PWAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PWAModal({ isOpen, onClose }: PWAModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Detect environment and listen for PWA install events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Standalone check (already installed and running as PWA)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Platform detection
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream: unknown }).MSStream;
    const android = /Android/i.test(ua);
    const inApp = /(FBAN|FBAV|Instagram|Line|Twitter|Snapchat|LinkedIn|MicroMessenger)/i.test(ua);

    setIsIOS(ios);
    setIsAndroid(android);
    setIsInAppBrowser(inApp);

    // Check if globally captured already
    if (window.deferredPWAInstallPrompt) {
      setDeferredPrompt(window.deferredPWAInstallPrompt);
    }

    const handlePromptAvailable = (e: Event) => {
      const custom = e as CustomEvent<BeforeInstallPromptEvent>;
      if (custom.detail) {
        setDeferredPrompt(custom.detail);
      } else if (window.deferredPWAInstallPrompt) {
        setDeferredPrompt(window.deferredPWAInstallPrompt);
      }
    };

    const handleBeforeInstall = (e: Event) => {
      try {
        e.preventDefault();
        const pEvent = e as BeforeInstallPromptEvent;
        window.deferredPWAInstallPrompt = pEvent;
        setDeferredPrompt(pEvent);
      } catch (_) {}
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.deferredPWAInstallPrompt = null;
      setTimeout(() => {
        onClose();
        setIsInstalled(false);
      }, 2000);
    };

    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installed', handleAppInstalled);
    };
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trigger native browser install prompt
  const handleInstallClick = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const prompt = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPWAInstallPrompt : null);

    if (prompt) {
      setIsInstalling(true);
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') {
            window.deferredPWAInstallPrompt = null;
          }
          setTimeout(() => {
            onClose();
            setIsInstalled(false);
          }, 2000);
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
      } finally {
        setIsInstalling(false);
      }
    }
  }, [deferredPrompt, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-[380px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-200 ease-out z-10 p-6 text-center animate-in fade-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* App Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#2563EB] shadow-lg shadow-blue-500/25 mb-3 flex items-center justify-center overflow-hidden border border-blue-400/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="TaskFlow App Icon"
            className="w-full h-full object-cover"
            onError={(ev) => {
              ev.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Title & Tagline */}
        <h3 id="pwa-modal-title" className="text-xl font-bold text-slate-900 mb-1">
          Install TaskFlow
        </h3>
        <p className="text-[12.5px] text-slate-500 mb-5 leading-normal">
          Fast, full-screen app experience with offline mode on your mobile home screen.
        </p>

        {/* Case 1: App Installed Successfully */}
        {isInstalled ? (
          <div className="py-5 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2 animate-in zoom-in-90 duration-200">
            <CheckCircle2 size={36} className="text-emerald-600 mx-auto animate-bounce" />
            <h4 className="font-bold text-[15px]">Installed Successfully!</h4>
            <p className="text-[12px] text-emerald-700 leading-relaxed">
              TaskFlow has been added to your device. You can now launch it directly from your home screen.
            </p>
          </div>
        ) : isStandalone ? (
          /* Case 2: Already running in standalone PWA mode */
          <div className="space-y-4">
            <div className="py-4 px-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-900 text-left text-[12.5px] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-blue-700 text-[13px]">
                <CheckCircle2 size={16} />
                <span>Already Installed & Running</span>
              </div>
              <p className="text-blue-800/80">
                You are currently running TaskFlow as an installed app. Offline mode and notifications are active.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13.5px] font-semibold transition-colors cursor-pointer"
            >
              Continue Working
            </button>
          </div>
        ) : deferredPrompt ? (
          /* Case 3: Native Install Prompt Available (Android Chrome, Edge, etc.) */
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left text-[12px] space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-[13px]">
                <Sparkles size={15} className="text-blue-600" />
                <span>App Features</span>
              </div>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Instant 1-tap launch from your home screen</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Full-screen view with zero browser clutter</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Works offline with automatic background sync</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[14px] font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98] disabled:opacity-70"
            >
              <Download size={18} />
              <span>{isInstalling ? 'Installing TaskFlow...' : 'Install TaskFlow App'}</span>
            </button>
          </div>
        ) : isIOS ? (
          /* Case 4: Apple iOS Safari (no programmatic beforeinstallprompt) */
          <div className="space-y-4">
            <div className="text-left bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-[12.5px] text-slate-700 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-[13px]">
                <Smartphone size={16} className="text-blue-600" />
                <span>To install on iPhone & iPad:</span>
              </div>
              <ol className="space-y-2 text-slate-600 leading-snug">
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the <span className="font-semibold text-slate-800">Share</span> button{' '}
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-blue-600 text-[11px]">
                      <Share size={12} className="inline mr-1" />
                      Share
                    </span>{' '}
                    in Safari&apos;s bottom toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-800 text-[11px]">
                      <PlusSquare size={12} className="inline mr-1 text-slate-600" />
                      Add to Home Screen
                    </span>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <span className="font-bold text-blue-600">Add</span> in the top-right corner to finish.
                  </span>
                </li>
              </ol>
              <p className="text-[11px] text-slate-400 border-t border-slate-200/70 pt-2 leading-relaxed">
                Tip: If using Chrome or Edge on iOS, tap Menu (⋯) → Share → Add to Home Screen.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : isAndroid ? (
          /* Case 5: Android without native prompt (e.g. In-App browser, Firefox, or prompt pending) */
          <div className="space-y-4">
            {isInAppBrowser ? (
              <div className="text-left bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[12.5px] text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <ExternalLink size={16} />
                  <span>Open in Chrome to Install</span>
                </div>
                <p className="text-amber-800 leading-relaxed text-[12px]">
                  You are viewing this inside an in-app browser (e.g., Instagram, Messenger, or LinkedIn).
                </p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800 text-[12px]">
                  <li>Tap the menu (<MoreVertical size={13} className="inline" /> or ⋯) in the top-right.</li>
                  <li>Select <strong>&quot;Open in Chrome&quot;</strong> or your system browser.</li>
                  <li>Then tap <strong>Install App</strong> from the menu.</li>
                </ol>
              </div>
            ) : (
              <div className="text-left bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-[12.5px] text-slate-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-[13px]">
                  <Smartphone size={16} className="text-blue-600" />
                  <span>To install on Android:</span>
                </div>
                <ol className="space-y-2 text-slate-600 leading-snug">
                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Tap the <span className="font-semibold text-slate-800">Three dots (⋮)</span> menu in the top-right corner of Chrome.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Select <span className="font-semibold text-slate-800">&quot;Install app&quot;</span> or{' '}
                      <span className="font-semibold text-slate-800">&quot;Add to Home screen&quot;</span>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Tap <span className="font-bold text-blue-600">Install</span> on the popup confirmation.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        ) : (
          /* Case 6: Desktop without native prompt */
          <div className="space-y-4">
            <div className="text-left bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-[12.5px] text-slate-700 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-[13px]">
                <Laptop size={16} className="text-blue-600" />
                <span>To install on Desktop:</span>
              </div>
              <ol className="space-y-2 text-slate-600 leading-snug">
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Look for the <span className="font-semibold text-slate-800">Install App</span> icon{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-200 font-medium text-slate-700 text-[11px]">
                      <Download size={11} className="inline mr-1 text-blue-600" /> Install
                    </span>{' '}
                    on the right side of your browser address bar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Or click browser menu (<MoreVertical size={13} className="inline" />) →{' '}
                    <span className="font-semibold text-slate-800">&quot;Install TaskFlow&quot;</span>.
                  </span>
                </li>
              </ol>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13.5px] transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
