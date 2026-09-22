'use client';

/**
 * src/components/ui/Toast.tsx
 *
 * Industry-standard, accessible global toast notification system.
 *
 * Architectural Mandates:
 * - High-signal, noise-free Linear/Supabase aesthetic.
 * - Under 150ms cubic-bezier entrance transition.
 * - Zero memory leaks: all timers tracked and cleaned up on unmount or dismiss.
 * - Accessible: ARIA live-region support, keyboard dismissable (Escape key).
 * - Multi-variant: success, error, info, warning.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  show: (type: ToastType, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Context Provider
// ---------------------------------------------------------------------------

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up all timers on unmount to prevent memory leaks
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach(timer => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // Keyboard dismiss (Escape key dismisses the latest toast)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToasts(prev => {
          if (prev.length === 0) return prev;
          const latest = prev[prev.length - 1];
          const timer = timersRef.current.get(latest.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(latest.id);
          }
          return prev.slice(0, -1);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const duration = options?.duration ?? DEFAULT_DURATION;

      const newToast: ToastItem = {
        id,
        type,
        message,
        title: options?.title,
        duration,
      };

      setToasts(prev => [...prev.slice(-4), newToast]); // Cap at 5 concurrent toasts to prevent UI clutter

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((message: string, options?: ToastOptions) => show('success', message, options), [show]);
  const error   = useCallback((message: string, options?: ToastOptions) => show('error', message, options), [show]);
  const info    = useCallback((message: string, options?: ToastOptions) => show('info', message, options), [show]);
  const warning = useCallback((message: string, options?: ToastOptions) => show('warning', message, options), [show]);

  return (
    <ToastContext.Provider value={{ toasts, show, success, error, info, warning, dismiss, clearAll }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer Hook
// ---------------------------------------------------------------------------

const noopToast: ToastContextValue = {
  toasts: [],
  show: () => '',
  success: () => '',
  error: () => '',
  info: () => '',
  warning: () => '',
  dismiss: () => {},
  clearAll: () => {},
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return noopToast;
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// UI Icons (Optimized SVG primitives)
// ---------------------------------------------------------------------------

function SuccessIcon() {
  return (
    <svg className="w-4 h-4 text-[#16A34A] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-4 h-4 text-[#DC2626] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 text-[#D97706] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Toast Visual Item
// ---------------------------------------------------------------------------

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const typeStyles: Record<ToastType, { border: string; bg: string; icon: React.ReactNode }> = {
    success: {
      border: 'border-[#BBF7D0]',
      bg: 'bg-white',
      icon: <SuccessIcon />,
    },
    error: {
      border: 'border-[#FECACA]',
      bg: 'bg-white',
      icon: <ErrorIcon />,
    },
    warning: {
      border: 'border-[#FDE68A]',
      bg: 'bg-white',
      icon: <WarningIcon />,
    },
    info: {
      border: 'border-[#BFDBFE]',
      bg: 'bg-white',
      icon: <InfoIcon />,
    },
  };

  const current = typeStyles[item.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-toast-in pointer-events-auto flex items-start gap-3 w-80 max-w-[calc(100vw-32px)] p-3.5 rounded-lg border shadow-lg ${current.border} ${current.bg} text-[#111111] transition-all`}
    >
      <div className="pt-0.5">{current.icon}</div>
      <div className="flex-1 min-w-0">
        {item.title && <div className="text-[13px] font-semibold tracking-tight text-[#111111]">{item.title}</div>}
        <div className="text-[12.5px] leading-snug text-[#374151] break-words">{item.message}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="text-[#9CA3AF] hover:text-[#4B5563] p-0.5 rounded transition-colors -mr-1 -mt-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast Container Component
// ---------------------------------------------------------------------------

export function ToastContainer() {
  const ctx = useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2 pointer-events-none select-none"
    >
      {ctx.toasts.map(toast => (
        <ToastCard key={toast.id} item={toast} onDismiss={() => ctx.dismiss(toast.id)} />
      ))}
    </aside>
  );
}
