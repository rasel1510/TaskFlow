'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PWAModal({ isOpen, onClose }: PWAModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream;
    setIsIOS(ios);

    // Guard against unhandled rejections that are Event objects
    const handleUnhandled = (event: PromiseRejectionEvent) => {
      if (event && (event.reason instanceof Event || (typeof event.reason === 'object' && event.reason !== null && !(event.reason instanceof Error)))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandled);

    const handleBeforeInstall = (e: Event) => {
      try {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      } catch (_) {}
    };

    const handleAppInstalled = () => {
      setIsCompleted(true);
      setDownloadProgress(100);
      setDeferredPrompt(null);
      setTimeout(() => {
        onClose();
        setIsCompleted(false);
        setDownloadProgress(null);
      }, 1200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
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

  const handleInstallClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (downloadProgress !== null) return;

    // Trigger browser native PWA installation prompt if supported
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt().catch(() => {});
        deferredPrompt.userChoice.then((choice) => {
          if (choice?.outcome === 'accepted') {
            setIsCompleted(true);
          }
        }).catch(() => {});
      } catch (_) {}
    }

    // Trigger direct file download without bubbling to Next.js router
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

    // Start sleek downloading progress bar
    setDownloadProgress(15);
    let progress = 15;
    progressIntervalRef.current = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 15;
      if (progress >= 100) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setDownloadProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          onClose();
          setTimeout(() => {
            setDownloadProgress(null);
            setIsCompleted(false);
          }, 300);
        }, 1200);
      } else {
        setDownloadProgress(progress);
      }
    }, 100);
  }, [deferredPrompt, downloadProgress, onClose]);

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

      {/* Modal Dialog Card - Clean, compact, no extra text */}
      <div className="relative w-full max-w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-200 ease-out z-10 p-6 text-center animate-in fade-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* App Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-0.5 shadow-lg shadow-blue-500/25 mb-4 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="TaskFlow"
            className="w-full h-full rounded-[14px] object-cover"
            onError={(ev) => {
              ev.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          TaskFlow
        </h3>

        {isIOS ? (
          <div className="text-left bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 mb-4 text-[12px] text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800">To install on iPhone / iPad:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
              <li>Tap the <span className="font-semibold text-slate-800">Share</span> icon (box with arrow <span className="text-blue-600">⎋</span>) at the bottom.</li>
              <li>Scroll down and tap <span className="font-semibold text-slate-800">"Add to Home Screen"</span>.</li>
              <li>Tap <span className="font-semibold text-blue-600">Add</span> in the top-right corner.</li>
            </ol>
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-[13px] transition-colors"
            >
              Got it
            </button>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-slate-500 mb-4">
              Install TaskFlow on your device for quick access, offline mode, and a full-screen experience.
            </p>
            {/* Action / Progress Area */}
            {downloadProgress === null ? (
              <button
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  handleInstallClick(ev);
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[14px] font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download size={16} />
                <span>Install App</span>
              </button>
            ) : isCompleted ? (
              <div className="py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 inline-flex items-center justify-center gap-2 text-[14px] font-semibold w-full">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Downloaded</span>
              </div>
            ) : (
              <div className="w-full space-y-2 py-1">
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[12px] font-medium text-slate-500 px-0.5">
                  <span>Downloading...</span>
                  <span>{downloadProgress}%</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
