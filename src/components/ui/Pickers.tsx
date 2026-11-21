'use client';

/**
 * Polished replacements for the browser's native <select> and date picker.
 *
 * Both render their panel in a portal with fixed positioning, so they are never clipped by
 * scrolling containers (like the project task table). Panels flip above the trigger when there
 * is no room below, stay inside the viewport, close on outside press / Escape / scroll, and are
 * keyboard accessible (listbox + grid semantics).
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// ---------------------------------------------------------------------------
// Floating panel positioning
// ---------------------------------------------------------------------------

interface FloatingPos {
  top: number;
  left: number;
  width: number;
  placement: 'below' | 'above';
}

/** Anchors a fixed panel to `anchor`; returns null until measured. */
function useFloatingPanel(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  panel: React.RefObject<HTMLElement | null>,
  opts: { width?: number; minWidth?: number; onClose: () => void }
) {
  const [pos, setPos] = useState<FloatingPos | null>(null);
  const { width, minWidth = 0, onClose } = opts;

  const measure = useCallback(() => {
    const a = anchor.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(Math.max(width ?? r.width, minWidth), vw - 16);
    const h = panel.current?.offsetHeight ?? 280;
    const spaceBelow = vh - r.bottom;
    const placement: FloatingPos['placement'] = spaceBelow < h + 12 && r.top > spaceBelow ? 'above' : 'below';
    const top = placement === 'below' ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    const left = Math.max(8, Math.min(r.left, vw - w - 8));
    setPos(prev =>
      prev && prev.top === top && prev.left === left && prev.width === w && prev.placement === placement
        ? prev
        : { top, left, width: w, placement }
    );
  }, [anchor, panel, width, minWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    measure();
    // Re-measure once the panel has rendered (its real height decides above/below)
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const onScroll = (e: Event) => {
      // Scrolling inside the panel is fine; scrolling the page/table moves the anchor away
      if (panel.current && e.target instanceof Node && panel.current.contains(e.target)) return;
      onClose();
    };
    const onResize = () => measure();
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, anchor, panel, onClose, measure]);

  return pos;
}

const PANEL_BASE =
  'fixed z-[80] rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_-8px_rgba(17,17,17,0.18),0_2px_6px_rgba(17,17,17,0.06)] outline-none';

// ---------------------------------------------------------------------------
// SelectMenu
// ---------------------------------------------------------------------------

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Small colored dot before the label (status / priority) */
  dot?: string;
  /** Text color of the label (e.g. status color) */
  tone?: string;
}

const TRIGGER_FIELD =
  'w-full min-w-0 h-8 pl-2.5 pr-2 inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white text-left text-[12.5px] text-[#111111] hover:border-[#D1D5DB] focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#DBEAFE] outline-none transition-[border-color,box-shadow] duration-150 ease-out cursor-pointer';

export function SelectMenu<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select',
  allowEmpty = false,
  emptyLabel = 'None',
  minMenuWidth = 168,
  renderValue,
  triggerClassName,
}: {
  value: V | '';
  options: SelectOption<V>[];
  onChange: (value: V | '') => void;
  ariaLabel: string;
  placeholder?: string;
  /** Adds a "None" row that clears the value */
  allowEmpty?: boolean;
  emptyLabel?: string;
  minMenuWidth?: number;
  /** Custom trigger content (defaults to dot + label) */
  renderValue?: (opt: SelectOption<V> | undefined) => React.ReactNode;
  /** Replaces the default form-field look of the trigger */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const rows = useMemo<(SelectOption<V> | { value: ''; label: string })[]>(
    () => (allowEmpty ? [{ value: '' as const, label: emptyLabel }, ...options] : options),
    [allowEmpty, emptyLabel, options]
  );
  const selected = options.find(o => o.value === value);

  const close = useCallback(() => setOpen(false), []);
  const pos = useFloatingPanel(open, triggerRef, panelRef, { minWidth: minMenuWidth, onClose: close });

  const openMenu = () => {
    const idx = rows.findIndex(r => r.value === value);
    setActive(idx < 0 ? 0 : idx);
    setOpen(true);
  };

  const choose = (v: V | '') => {
    setOpen(false);
    triggerRef.current?.focus();
    if (v !== value) onChange(v);
  };

  // Keep the keyboard-active row in view
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(rows.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(rows[active].value as V | '');
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
    } else if (e.key.length === 1) {
      // Type-ahead: jump to the first option starting with the typed letter
      const ch = e.key.toLowerCase();
      const idx = rows.findIndex(r => r.label.toLowerCase().startsWith(ch));
      if (idx >= 0) setActive(idx);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={e => {
          stop(e);
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        className={`${triggerClassName ?? TRIGGER_FIELD} ${open && !triggerClassName ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]' : ''}`}
      >
        {renderValue ? (
          renderValue(selected)
        ) : (
          <>
            {selected?.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selected.dot }} />}
            <span className={`flex-1 min-w-0 truncate ${selected ? '' : 'text-[#9CA3AF]'}`}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-[#9CA3AF] transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            onClick={stop}
            onKeyDown={onKeyDown}
            className={`${PANEL_BASE} p-1 max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain animate-in fade-in-0 zoom-in-95 duration-100`}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {rows.map((row, i) => {
              const isSelected = row.value === value;
              const opt = row as SelectOption<V>;
              return (
                <button
                  key={row.value || '__empty'}
                  type="button"
                  role="option"
                  data-index={i}
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(row.value as V | '')}
                  className={`w-full flex items-center gap-2.5 h-9 sm:h-8 px-2.5 rounded-lg text-left text-[13px] transition-colors duration-75 cursor-pointer ${
                    i === active ? 'bg-[#F3F4F6]' : ''
                  } ${row.value === '' ? 'text-[rgba(17,17,17,0.5)]' : 'text-[#111111]'}`}
                >
                  {row.value === '' ? (
                    <span className="w-2 h-2 rounded-full shrink-0 border border-dashed border-[#D1D5DB]" />
                  ) : opt.dot ? (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />
                  ) : null}
                  <span className="flex-1 min-w-0 truncate" style={opt.tone ? { color: opt.tone } : undefined}>
                    {row.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#2563EB]" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');
/** Local-date key, YYYY-MM-DD */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Month grid with shortcuts. Keyboard: arrows move a day/week, PageUp/PageDown change month. */
function CalendarPanel({
  value,
  onSelect,
  onClear,
  label,
}: {
  value: string | null;
  onSelect: (key: string) => void;
  onClear: () => void;
  label: string;
}) {
  const todayKey = toDateKey(new Date());
  const [focusKey, setFocusKey] = useState(value ?? todayKey);
  const focusDate = fromDateKey(focusKey);
  const [view, setView] = useState({ y: focusDate.getFullYear(), m: focusDate.getMonth() });
  const gridRef = useRef<HTMLDivElement>(null);

  // 6×7 grid starting on the Sunday on/before the 1st
  const days = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view]);

  const moveFocus = (next: Date) => {
    const key = toDateKey(next);
    setFocusKey(key);
    if (next.getMonth() !== view.m || next.getFullYear() !== view.y) setView({ y: next.getFullYear(), m: next.getMonth() });
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus());
  };

  const shiftMonth = (delta: number) => setView(v => {
    const d = new Date(v.y, v.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const onGridKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(addDays(fromDateKey(focusKey), map[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const f = fromDateKey(focusKey);
      moveFocus(new Date(f.getFullYear(), f.getMonth() + (e.key === 'PageUp' ? -1 : 1), Math.min(f.getDate(), 28)));
    }
  };

  // Focus the selected (or today's) day when the panel opens
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)?.focus({ preventScroll: true })
    );
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const shortcuts = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: addDays(today, 7) },
  ];

  return (
    <div className="p-3 select-none" role="dialog" aria-label={`Choose ${label}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="pl-1 text-[13.5px] font-semibold text-[#111111]" aria-live="polite">
          {MONTHS[view.m]} {view.y}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-8 h-8 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-lg text-[rgba(17,17,17,0.6)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-lg text-[rgba(17,17,17,0.6)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 mb-1" aria-hidden="true">
        {WEEKDAYS.map(d => (
          <span key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-[rgba(17,17,17,0.4)]">
            {d}
          </span>
        ))}
      </div>

      {/* Days */}
      <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-y-0.5">
        {days.map(d => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === view.m;
          const isSelected = key === value;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-key={key}
              tabIndex={key === focusKey ? 0 : -1}
              aria-selected={isSelected}
              aria-label={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              onClick={() => onSelect(key)}
              onFocus={() => setFocusKey(key)}
              className={`relative mx-auto w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg text-[12.5px] tabular-nums outline-none transition-colors duration-75 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#93C5FD] ${
                isSelected
                  ? 'bg-[#2563EB] text-white font-semibold shadow-sm hover:bg-[#1D4ED8]'
                  : isToday
                    ? 'text-[#2563EB] font-semibold hover:bg-[#EFF6FF]'
                    : inMonth
                      ? 'text-[#111111] hover:bg-[#F3F4F6]'
                      : 'text-[rgba(17,17,17,0.28)] hover:bg-[#F9FAFB]'
              }`}
            >
              {d.getDate()}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2563EB]" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Shortcuts */}
      <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex items-center gap-1.5">
        {shortcuts.map(s => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelect(toDateKey(s.date))}
            className="h-7 px-2.5 rounded-md bg-[#F3F4F6] text-[12px] font-medium text-[rgba(17,17,17,0.75)] hover:bg-[#E5E7EB] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap"
          >
            {s.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto h-7 px-2 rounded-md text-[12px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Date trigger + calendar popover. Pass a `renderTrigger` to control the look of the button;
 * values are YYYY-MM-DD strings (or null).
 */
export function DatePopover({
  value,
  onChange,
  label,
  renderTrigger,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  renderTrigger: (args: {
    ref: React.Ref<HTMLButtonElement>;
    open: boolean;
    toggle: (e: React.SyntheticEvent) => void;
    ariaProps: React.AriaAttributes;
  }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const pos = useFloatingPanel(open, triggerRef, panelRef, { width: 296, onClose: close });

  const finish = (next: string | null) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== value) onChange(next);
  };

  return (
    <>
      {renderTrigger({
        ref: triggerRef,
        open,
        toggle: e => {
          stop(e);
          setOpen(o => !o);
        },
        ariaProps: { 'aria-haspopup': 'dialog', 'aria-expanded': open },
      })}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            onClick={stop}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                finish(value);
              }
            }}
            className={`${PANEL_BASE} animate-in fade-in-0 zoom-in-95 duration-100`}
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            <CalendarPanel value={value} label={label} onSelect={finish} onClear={() => finish(null)} />
          </div>,
          document.body
        )}
    </>
  );
}
