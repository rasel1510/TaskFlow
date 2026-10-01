'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, CheckCircle2 } from 'lucide-react';

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
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'installed'>('idle');
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with global PWA capture
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      setInstallStatus('installed');
      setProgress(100);
      setDeferredPrompt(null);
      window.deferredPWAInstallPrompt = null;
      setTimeout(() => {
        onClose();
        setInstallStatus('idle');
        setProgress(0);
      }, 1200);
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
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
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

  // One-click install action for all users everywhere
  const handleInstallClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (installStatus !== 'idle') return;

    const prompt = deferredPrompt || (typeof window !== 'undefined' ? window.deferredPWAInstallPrompt : null);

    // 1. Trigger native browser PWA install prompt if available
    if (prompt) {
      try {
        prompt.prompt().catch(() => {});
        prompt.userChoice.then((choice) => {
          if (choice?.outcome === 'accepted') {
            setInstallStatus('installed');
            setProgress(100);
            window.deferredPWAInstallPrompt = null;
            setTimeout(() => {
              onClose();
              setInstallStatus('idle');
            }, 1200);
          }
        }).catch(() => {});
      } catch (_) {}
    }

    // 2. Also trigger direct desktop app launcher shortcut safely without bubbling
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

    // 3. Smooth one-click installation progress
    setInstallStatus('installing');
    setProgress(20);
    let cur = 20;
    progressIntervalRef.current = setInterval(() => {
      cur += Math.floor(Math.random() * 25) + 20;
      if (cur >= 100) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgress(100);
        setInstallStatus('installed');
        setTimeout(() => {
          onClose();
          setTimeout(() => {
            setInstallStatus('idle');
            setProgress(0);
          }, 300);
        }, 1200);
      } else {
        setProgress(cur);
      }
    }, 100);
  }, [deferredPrompt, installStatus, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card - Ultra clean 1-click interface, zero extra text, zero 'Got it' */}
      <div className="relative w-full max-w-[320px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-200 ease-out z-10 p-6 text-center animate-in fade-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* App Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#2563EB] shadow-lg shadow-blue-500/25 mb-3 flex items-center justify-center overflow-hidden border border-blue-400/30">
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

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 mb-5">
          TaskFlow
        </h3>

        {/* 1-Click Action Button / Progress */}
        {installStatus === 'idle' ? (
          <button
            onClick={handleInstallClick}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-[14px] font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download size={16} />
            <span>Install App</span>
          </button>
        ) : installStatus === 'installing' ? (
          <div className="w-full space-y-2 py-1">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2563EB] h-full rounded-full transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[12px] font-medium text-slate-500 px-0.5">
              <span>Installing...</span>
              <span>{progress}%</span>
            </div>
          </div>
        ) : (
          <div className="py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 inline-flex items-center justify-center gap-2 text-[14px] font-semibold w-full">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>Installed</span>
          </div>
        )}
      </div>
    </div>
  );
}
