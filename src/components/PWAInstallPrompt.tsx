'use client';

/**
 * PWAInstallPrompt
 *
 * Lightweight, non-intrusive 1-click install banner that appears when
 * the browser provides a native PWA installation capability.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const DISMISSED_KEY = 'flowsync-pwa-dismissed';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Do not show if running standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Do not show if dismissed in this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Check if globally captured
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
      setVisible(false);
      setDeferredPrompt(null);
      window.deferredPWAInstallPrompt = null;
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
  }, []);

  // Animate in when prompt state becomes available
  useEffect(() => {
    if (deferredPrompt) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
    setTimeout(() => {
      setDeferredPrompt(null);
    }, 350);
  }, []);

  const handleInstall = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const prompt = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPWAInstallPrompt : null);

    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          dismiss();
          return;
        }
      } catch (_) {}
    }

    // Direct safe launcher shortcut trigger
    try {
      const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/app` : '/app';
      const fileContent = `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`;
      const blob = new Blob([fileContent], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'TaskFlow.url';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', (ev) => ev.stopPropagation());
      a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
      setTimeout(() => {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch (_) {}
      }, 2000);
    } catch (_) {}

    dismiss();
  }, [deferredPrompt, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="pwa-install-banner fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9990] w-[calc(100vw-2rem)] max-w-sm"
      role="dialog"
      aria-label="Install TaskFlow app"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          {/* App Icon */}
          <div className="w-11 h-11 rounded-xl bg-[#2563EB] overflow-hidden shrink-0 shadow-sm border border-blue-400/30 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt="TaskFlow"
              className="w-full h-full object-cover"
              onError={(ev) => {
                ev.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#111111]">Install TaskFlow</p>
            <p className="text-[11.5px] text-[#6B7280] leading-snug">
              Fast, standalone workspace with offline support.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* 1-Click Install Action */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <button
            onClick={handleInstall}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[13px] font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download size={15} />
            <span>Install App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
