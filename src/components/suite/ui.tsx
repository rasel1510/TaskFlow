'use client';

/**
 * src/components/suite/ui.tsx — the calm, consistent building blocks of every Software Company
 * suite screen: page header with tabs, buttons, badges, a side drawer for forms, fields, a table,
 * stats and empty states. Neutral colours, one accent (#2563EB), 150 ms ease-out transitions.
 */
import React, { useEffect, useState } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ── Page ─────────────────────────────────────────────────────────────────────────────────── */

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

export function PageShell({
  title,
  subtitle,
  actions,
  tabs,
  tab,
  onTab,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs?: TabDef[];
  tab?: string;
  onTab?: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-white">
      <div className="shrink-0 border-b border-[#E5E7EB] px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[17px] sm:text-lg font-semibold text-[#111111] tracking-tight truncate">{title}</h1>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-neutral-500 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {tabs && tabs.length > 0 && (
          <nav className="mt-3 -mb-px flex gap-5 overflow-x-auto no-scrollbar" aria-label={`${title} sections`}>
            {tabs.map(t => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab?.(t.id)}
                  className={cx(
                    'shrink-0 pb-2.5 text-[13px] font-medium border-b-2 transition-colors duration-150 ease-out cursor-pointer',
                    active ? 'border-[#2563EB] text-[#111111]' : 'border-transparent text-neutral-500 hover:text-[#111111]'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {t.label}
                  {typeof t.count === 'number' && <span className="ml-1.5 text-[11px] text-neutral-400 tabular-nums">{t.count}</span>}
                </button>
              );
            })}
          </nav>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-5 max-w-[1400px]">{children}</div>
      </div>
    </div>
  );
}

export function SectionHeader({ title, hint, actions }: { title: string; hint?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-[#111111]">{title}</h2>
        {hint && <p className="text-[12px] text-neutral-500 mt-0.5">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Controls ─────────────────────────────────────────────────────────────────────────────── */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]',
        variant === 'secondary' && 'bg-white text-[#111111] border border-[#E5E7EB] hover:bg-neutral-50',
        variant === 'ghost' && 'text-neutral-600 hover:bg-neutral-100 hover:text-[#111111]',
        variant === 'danger' && 'text-red-600 hover:bg-red-50',
        className
      )}
    />
  );
}

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center h-5 px-1.5 rounded-md text-[11px] font-medium whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[12px] font-medium text-neutral-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-neutral-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[13px] text-[#111111] placeholder:text-neutral-400 transition-colors duration-150 ease-out focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:bg-neutral-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} {...props} className={cx(inputBase, 'h-8', className)} />;
});

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputBase, 'py-2 min-h-[84px] resize-y leading-relaxed', className)} />;
}

export function Select({
  options,
  className,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={cx(inputBase, 'h-8 pr-7 cursor-pointer', className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="pl-8" aria-label={placeholder} />
    </div>
  );
}

/** Two-step delete: the first click asks, the second confirms (no pop-up dialogs). */
export function ConfirmButton({ label = 'Delete', onConfirm, disabled }: { label?: string; onConfirm: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(t);
  }, [asking]);
  return asking ? (
    <Button variant="danger" size="sm" onClick={onConfirm} disabled={disabled}>
      Confirm {label.toLowerCase()}
    </Button>
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setAsking(true)} disabled={disabled}>
      {label}
    </Button>
  );
}

/* ── Drawer (forms and details) ───────────────────────────────────────────────────────────── */

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className={cx('absolute right-0 top-0 h-full w-full bg-white border-l border-[#E5E7EB] shadow-xl flex flex-col', wide ? 'sm:w-[640px]' : 'sm:w-[440px]')}>
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[#E5E7EB]">
          <h2 className="text-[14px] font-semibold text-[#111111] truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-[#111111] hover:bg-neutral-100 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">{children}</div>
        {footer && <div className="shrink-0 border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Data display ─────────────────────────────────────────────────────────────────────────── */

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: React.ReactNode }) {
  const rows = React.Children.count(children);
  return (
    <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-neutral-50/80 border-b border-[#E5E7EB]">
              {head.map(h => (
                <th key={h} scope="col" className="text-left font-medium text-[11.5px] text-neutral-500 px-3 py-2 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F1F1]">{children}</tbody>
        </table>
      </div>
      {rows === 0 && empty}
    </div>
  );
}

export function Row({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <tr onClick={onClick} className={cx('transition-colors duration-150 ease-out', onClick && 'cursor-pointer hover:bg-neutral-50')}>
      {children}
    </tr>
  );
}

export function Cell({ children, className, muted }: { children?: React.ReactNode; className?: string; muted?: boolean }) {
  return <td className={cx('px-3 py-2.5 align-middle', muted ? 'text-neutral-500' : 'text-[#111111]', className)}>{children}</td>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="py-12 px-4 text-center">
      <p className="text-[13.5px] font-medium text-[#111111]">{title}</p>
      {hint && <p className="mt-1 text-[12.5px] text-neutral-500 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl px-4 py-3.5">
      <p className="text-[12px] text-neutral-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight text-[#111111] tabular-nums">{value}</p>
      {hint && <p className={cx('mt-0.5 text-[11.5px]', tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-neutral-400')}>{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function Person({ name }: { name: string }) {
  if (!name) return <span className="text-neutral-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Avatar name={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-neutral-100/70" />
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'amber' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-150 ease-out', tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-[#2563EB]')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── Formatting ───────────────────────────────────────────────────────────────────────────── */

export function money(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function date(value: string | Date | null | undefined, withYear = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear || d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

export function ago(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return date(value);
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export const label = (v: string | null | undefined) =>
  (v || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
