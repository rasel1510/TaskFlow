'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  X,
  Smartphone,
  Laptop,
  Apple,
  Zap,
  WifiOff,
  Bell,
  CheckCircle2,
  Share,
  PlusSquare,
  Sparkles,
  ExternalLink
} from 'lucide-react';

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
  const [isStandalone, setIsStandalone] = useState(false);
  const [activeTab, setActiveTab] = useState<'desktop' | 'ios' | 'android'>('desktop');
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Platform detection & install prompt listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect standalone mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore iOS Safari standalone
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Auto-detect OS to pre-select the most relevant instruction tab
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setActiveTab('ios');
    } else if (/Android/.test(ua)) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => {
        onClose();
      }, 2500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('PWA install prompt error:', err);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all duration-200 ease-out z-10 my-auto animate-in fade-in zoom-in-95">
        {/* Glow Header Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8">
          {/* Brand & Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-0.5 shadow-md shadow-blue-500/20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192.png"
                alt="TaskFlow App Icon"
                className="w-full h-full rounded-[14px] object-cover"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 id="pwa-modal-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Install TaskFlow
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  <Sparkles size={11} />
                  PWA Ready
                </span>
              </div>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">
                Add TaskFlow directly to your system dock, desktop, or mobile home screen for instantaneous loading and native app performance.
              </p>
            </div>
          </div>

          {/* Value Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">Instant Launch</p>
                <p className="text-[11px] text-slate-500 truncate">Zero browser tabs</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                <WifiOff size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">Offline Ready</p>
                <p className="text-[11px] text-slate-500 truncate">Local cache & sync</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-purple-100/80 text-purple-600 flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">Direct Alerts</p>
                <p className="text-[11px] text-slate-500 truncate">Push notifications</p>
              </div>
            </div>
          </div>

          {/* Instant 1-Click Install Button (When browser provides beforeinstallprompt) */}
          {deferredPrompt && !installSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <p className="text-[13px] font-semibold text-blue-900">1-Click Fast Installation</p>
                <p className="text-[12px] text-blue-700">Your browser is ready to install TaskFlow immediately.</p>
              </div>
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download size={15} />
                <span>{isInstalling ? 'Installing...' : 'Install Now'}</span>
              </button>
            </div>
          )}

          {/* Success Banner */}
          {installSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-900">TaskFlow Successfully Installed!</p>
                <p className="text-[12px] text-emerald-700">You can now launch TaskFlow anytime from your desktop or home screen.</p>
              </div>
            </div>
          )}

          {/* Already in standalone mode */}
          {isStandalone && !installSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-slate-900">You are already using TaskFlow App</p>
                <p className="text-[12px] text-slate-600">Running in standalone mode with full offline and caching support.</p>
              </div>
            </div>
          )}

          {/* Step-by-Step Device Tabs */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <div className="flex border-b border-slate-200 bg-slate-50/80">
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Laptop size={14} />
                <span>Desktop (Chrome/Edge)</span>
              </button>

              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'ios'
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Apple size={14} />
                <span>iPhone / iPad</span>
              </button>

              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                  activeTab === 'android'
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Smartphone size={14} />
                <span>Android</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 bg-white text-[13px] text-slate-600 space-y-3">
              {activeTab === 'desktop' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="leading-relaxed">
                      Look at the right side of your browser address bar for the <strong className="text-slate-800">Install icon (⊕ or desktop icon)</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="leading-relaxed">
                      Click <strong className="text-slate-800">"Install TaskFlow"</strong> when prompted by Chrome, Edge, or Brave.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="leading-relaxed">
                      Optionally pin TaskFlow to your Windows Taskbar or macOS Dock for 1-click access.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="leading-relaxed">
                      In Safari, tap the <strong className="text-slate-800 inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[12px]"><Share size={12} /> Share</strong> button in the bottom navigation toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="leading-relaxed">
                      Scroll down through the share sheet options and tap <strong className="text-slate-800 inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[12px]"><PlusSquare size={12} /> Add to Home Screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="leading-relaxed">
                      Tap <strong className="text-slate-800 font-semibold">Add</strong> in the top right corner. The TaskFlow icon will appear directly on your home screen!
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'android' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="leading-relaxed">
                      In Chrome or Samsung Internet, tap the <strong className="text-slate-800">menu icon (⋮)</strong> in the top right.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="leading-relaxed">
                      Select <strong className="text-slate-800">"Install app"</strong> or <strong className="text-slate-800">"Add to Home screen"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="leading-relaxed">
                      Confirm installation. TaskFlow will be added to your app drawer and home screen.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Continue in Browser
            </button>
            {deferredPrompt && !installSuccess ? (
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isInstalling ? 'Installing...' : 'Install TaskFlow'}</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Got It</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
