'use client';

/**
 * PWAInstallPrompt
 *
 * Shows a native-looking "Add to Home Screen" banner on:
 * - Android/Chrome: listens for beforeinstallprompt
 * - iOS/Safari: detects standalone mode is not active + iOS browser
 *
 * Renders only once, dismissed permanently via localStorage flag.
 */

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'flowsync-pwa-dismissed';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't show if previously dismissed
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    // Don't show if already installed in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore — iOS-specific
      window.navigator.standalone === true;
    if (isStandalone) return;

    // iOS detection (no beforeinstallprompt support)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      // @ts-ignore
      !window.MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIOS && isSafari) {
      // Show iOS-specific guide after a delay
      const t = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(t);
    }

    // Chrome/Edge/Android — listen for native install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Animate in when prompt state becomes available
  useEffect(() => {
    if (deferredPrompt || showIOSPrompt) {
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [deferredPrompt, showIOSPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      dismiss();
    } else {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
    setTimeout(() => {
      setDeferredPrompt(null);
      setShowIOSPrompt(false);
    }, 350);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pwa-install-banner fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9990] w-[calc(100vw-2rem)] max-w-sm"
      role="dialog"
      aria-label="Install FlowSync app"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          {/* App Icon */}
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm border border-[#E5E7EB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="FlowSync" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#111111]">Install FlowSync</p>
            <p className="text-[11.5px] text-[#6B7280] leading-snug">
              Add to your home screen for the best experience — works offline too.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss install prompt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {showIOSPrompt && (
          <div className="px-4 pb-3 text-[12px] text-[#374151] space-y-1.5 bg-[#F9FAFB] border-t border-[#F3F4F6]">
            <p className="font-semibold text-[#111111]">To install on iOS:</p>
            <ol className="space-y-1 list-decimal list-inside text-[#4B5563]">
              <li>Tap the <span className="font-semibold">Share</span> button <span className="text-base">⎋</span> in Safari</li>
              <li>Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></li>
              <li>Tap <span className="font-semibold">Add</span> to confirm</li>
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[#F3F4F6]">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[13px] font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Install App
            </button>
          )}
          <button
            onClick={dismiss}
            className="flex-1 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-[13px] font-medium rounded-xl transition-colors cursor-pointer"
          >
            {deferredPrompt ? 'Not now' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
