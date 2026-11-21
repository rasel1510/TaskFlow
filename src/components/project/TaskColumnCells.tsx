'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X } from 'lucide-react';
import { DatePopover, SelectMenu } from '@/components/ui/Pickers';
import {
  formatHours,
  formatShortDate,
  hoursDraft,
  parseHours,
  type CustomColumn,
  type CustomFieldValue,
} from '@/lib/taskColumns';

/** Cells live inside a clickable task row — keep their clicks/keys from opening the task. */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Empty cells stay blank (hover shows they are editable), like monday.com. */
const EMPTY = null;

// ---------------------------------------------------------------------------
// Generic click-to-edit text input
// ---------------------------------------------------------------------------

interface InlineInputProps {
  /** What is shown when not editing (already formatted) */
  display: React.ReactNode;
  /** Starting value of the editor */
  initial: string;
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  /** Unit shown inside the editor, e.g. "hours" */
  suffix?: string;
  ariaLabel: string;
  /** Return false to reject the draft (editor stays open on Enter, reverts on blur). */
  onCommit: (draft: string) => boolean;
}

function InlineInput({ display, initial, placeholder, inputMode = 'text', suffix, ariaLabel, onCommit }: InlineInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const cancelled = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${ariaLabel}`}
        onClick={e => {
          stop(e);
          cancelled.current = false;
          setDraft(initial);
          setInvalid(false);
          setEditing(true);
        }}
        className="block w-full min-w-0 h-8 px-2 -mx-2 rounded-md text-left text-[12.5px] text-[rgba(17,17,17,0.75)] truncate hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-text"
      >
        {display}
      </button>
    );
  }

  return (
    <div className="relative -mx-2">
      <input
        type="text"
        autoFocus
        inputMode={inputMode}
        value={draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        // Select the existing value so typing replaces it
        onFocus={e => e.currentTarget.select()}
        onClick={stop}
        onChange={e => {
          setDraft(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            if (onCommit(draft)) {
              cancelled.current = true;
              setEditing(false);
            } else {
              setInvalid(true);
            }
          } else if (e.key === 'Escape') {
            cancelled.current = true;
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (!cancelled.current) onCommit(draft);
          setEditing(false);
        }}
        className={`w-full h-8 px-2 rounded-md bg-white text-[12.5px] text-[#111111] placeholder-[#9CA3AF] outline-none ring-2 ${
          suffix ? 'pr-11' : ''
        } ${invalid ? 'border border-[#DC2626] ring-[#FEE2E2]' : 'border border-[#2563EB] ring-[#DBEAFE]'}`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] text-[#9CA3AF] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time spent
// ---------------------------------------------------------------------------

export function TimeSpentCell({
  minutes,
  onSave,
  taskTitle,
}: {
  minutes: number | null | undefined;
  onSave: (minutes: number | null) => void;
  taskTitle: string;
}) {
  return (
    <div className="w-full min-w-0" onClick={stop}>
      <InlineInput
        ariaLabel={`time spent on ${taskTitle}`}
        display={minutes === null || minutes === undefined ? EMPTY : formatHours(minutes)}
        initial={hoursDraft(minutes)}
        placeholder="0.0"
        inputMode="decimal"
        suffix="hours"
        onCommit={draft => {
          const parsed = parseHours(draft);
          if (parsed === undefined) return false;
          if (parsed !== (minutes ?? null)) onSave(parsed);
          return true;
        }}
      />
    </div>
  );
}

/** Controlled hours field for forms (the "hours" unit is added automatically). */
export function HoursInput({
  value,
  onChange,
  onEnter,
  invalid = false,
  ariaLabel = 'Time spent in hours',
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative w-full min-w-0">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="0.0"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        className={`w-full h-8 pl-2.5 pr-11 rounded-md border bg-white text-[12.5px] text-[#111111] placeholder-[#9CA3AF] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-2 ${
          invalid
            ? 'border-[#DC2626] focus:ring-[#FEE2E2]'
            : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#DBEAFE]'
        }`}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-[#9CA3AF] pointer-events-none">
        hours
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom column cells
// ---------------------------------------------------------------------------

const PILL_PALETTE = [
  { bg: '#EFF6FF', fg: '#2563EB' },
  { bg: '#F5F3FF', fg: '#7C3AED' },
  { bg: '#F0FDF4', fg: '#16A34A' },
  { bg: '#FFF7ED', fg: '#EA580C' },
  { bg: '#ECFEFF', fg: '#0891B2' },
  { bg: '#FEF2F2', fg: '#DC2626' },
];

export function CustomFieldCell({
  column,
  value,
  onSave,
}: {
  column: CustomColumn;
  value: CustomFieldValue | undefined;
  onSave: (value: CustomFieldValue) => void;
}) {
  const label = column.title;

  switch (column.type) {
    case 'text': {
      const text = typeof value === 'string' ? value : '';
      return (
        <TextNoteCell
          label={label}
          value={text}
          onSave={next => {
            if (next !== text) onSave(next === '' ? null : next);
          }}
        />
      );
    }

    case 'number': {
      const num = typeof value === 'number' ? value : null;
      return (
        <div className="w-full min-w-0" onClick={stop}>
          <InlineInput
            ariaLabel={label}
            display={num === null ? EMPTY : num.toLocaleString('en-US', { maximumFractionDigits: 6 })}
            initial={num === null ? '' : String(num)}
            placeholder="0"
            inputMode="decimal"
            onCommit={draft => {
              const raw = draft.trim().replace(/,/g, '');
              if (raw === '') {
                if (num !== null) onSave(null);
                return true;
              }
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) return false;
              if (parsed !== num) onSave(parsed);
              return true;
            }}
          />
        </div>
      );
    }

    case 'date':
      return <DateField label={label} value={typeof value === 'string' ? value : null} onSave={onSave} />;

    case 'checkbox':
      return (
        <div className="flex items-center h-8" onClick={stop}>
          <input
            type="checkbox"
            checked={value === true}
            aria-label={label}
            onChange={e => onSave(e.target.checked ? true : null)}
            className="w-4 h-4 rounded border-[#D1D5DB] accent-[#2563EB] cursor-pointer"
          />
        </div>
      );

    case 'dropdown': {
      const options = column.options ?? [];
      const current = typeof value === 'string' && value ? value : '';
      const idx = options.indexOf(current);
      const tone = PILL_PALETTE[(idx < 0 ? 0 : idx) % PILL_PALETTE.length];
      const menuOptions = [
        ...(current && idx < 0 ? [current] : []),
        ...options,
      ].map(o => ({ value: o, label: o }));
      return (
        <div className="relative flex items-center h-8 min-w-0 w-full" onClick={stop}>
          <SelectMenu
            ariaLabel={label}
            value={current}
            options={menuOptions}
            allowEmpty
            emptyLabel="No value"
            onChange={v => onSave(v || null)}
            triggerClassName="w-full min-w-0 h-8 px-2 -mx-2 inline-flex items-center rounded-md text-left hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE]"
            renderValue={() =>
              current ? (
                <span
                  className="max-w-full truncate px-2 py-0.5 rounded-md text-[11.5px] font-medium"
                  style={{ backgroundColor: tone.bg, color: tone.fg }}
                >
                  {current}
                </span>
              ) : null
            }
          />
        </div>
      );
    }
  }
}

/**
 * Click-to-pick date with the FlowSync calendar popover. `cell` blends into a table row;
 * `field` looks like a form input. Values are YYYY-MM-DD strings.
 */
export function DateField({
  label,
  value,
  onSave,
  variant = 'cell',
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (value: string | null) => void;
  variant?: 'cell' | 'field';
  placeholder?: string;
}) {
  const isField = variant === 'field';

  return (
    <div className="group/date relative flex items-center h-8 min-w-0 w-full" onClick={stop}>
      <DatePopover
        value={value}
        onChange={onSave}
        label={label}
        renderTrigger={({ ref, open, toggle, ariaProps }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Edit ${label}`}
            {...ariaProps}
            onClick={toggle}
            className={
              isField
                ? `flex-1 min-w-0 h-8 pl-2.5 pr-7 inline-flex items-center gap-2 rounded-md border bg-white text-left text-[12.5px] text-[#111111] outline-none transition-[border-color,box-shadow] duration-150 ease-out cursor-pointer ${
                    open
                      ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]'
                      : 'border-[#E5E7EB] hover:border-[#D1D5DB] focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#DBEAFE]'
                  }`
                : `flex-1 min-w-0 h-8 px-2 -mx-2 rounded-md text-left text-[12.5px] text-[rgba(17,17,17,0.75)] truncate transition-colors duration-100 ease-out cursor-pointer ${
                    open ? 'bg-[#F3F4F6]' : 'hover:bg-[#F3F4F6]'
                  }`
            }
          >
            {isField && <CalendarDays className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" />}
            <span className="min-w-0 truncate">
              {value ? (
                formatShortDate(value)
              ) : isField ? (
                <span className="text-[#9CA3AF]">{placeholder ?? 'Select date'}</span>
              ) : (
                EMPTY
              )}
            </span>
          </button>
        )}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={e => {
            stop(e);
            onSave(null);
          }}
          className={`shrink-0 p-1 rounded text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-opacity cursor-pointer focus-visible:opacity-100 ${
            isField ? 'absolute right-1' : 'ml-1 opacity-0 group-hover/date:opacity-100'
          }`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text column: note editor
// ---------------------------------------------------------------------------

export const NOTE_MAX_LENGTH = 1000;
const NOTE_PANEL_WIDTH = 320;
const NOTE_PANEL_EST_HEIGHT = 200;

/**
 * Text cell. Shows the note on one line (full text on hover); clicking opens a
 * multi-line note box anchored to the cell.
 */
function TextNoteCell({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  /** Receives the trimmed note ('' = cleared) */
  onSave: (next: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="group/note w-full min-w-0" onClick={stop}>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`Edit ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={value || undefined}
        onClick={e => {
          stop(e);
          setOpen(true);
        }}
        className={`block w-full min-w-0 h-8 px-2 -mx-2 rounded-md border text-left text-[12.5px] truncate transition-colors duration-100 ease-out cursor-text ${
          open
            ? 'border-[#2563EB] bg-white ring-2 ring-[#DBEAFE]'
            : 'border-transparent hover:border-[#E5E7EB] hover:bg-white'
        } ${value ? 'text-[rgba(17,17,17,0.75)]' : ''}`}
      >
        {value ? (
          value.replace(/\s+/g, ' ')
        ) : (
          <span className="text-[#9CA3AF] opacity-0 group-hover/note:opacity-100 transition-opacity">Add a note</span>
        )}
      </button>
      {open && (
        <NoteEditor
          anchor={anchorRef.current}
          label={label}
          initial={value}
          onSave={onSave}
          onClose={() => {
            setOpen(false);
            anchorRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * Floating note box rendered in a portal (so the table's horizontal scroll never clips it).
 * Saves on Ctrl/Cmd+Enter, the Save button or clicking outside; Esc cancels.
 */
function NoteEditor({
  anchor,
  label,
  initial,
  onSave,
  onClose,
}: {
  anchor: HTMLElement | null;
  label: string;
  initial: string;
  onSave: (next: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the latest commit for document-level listeners
  const commitRef = useRef<() => void>(() => {});
  commitRef.current = () => {
    onSave(draft.trim().slice(0, NOTE_MAX_LENGTH));
    onClose();
  };

  const place = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < NOTE_PANEL_EST_HEIGHT + 8 && r.top > spaceBelow;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - NOTE_PANEL_WIDTH - 8));
    setPos({ top: above ? r.top - 6 : r.bottom + 6, left, above });
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  // Clicking anywhere outside the box saves (like monday.com)
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      commitRef.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [anchor]);

  // Grow with the content (up to a limit)
  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };
  useLayoutEffect(autosize, [draft]);

  if (!pos || typeof document === 'undefined') return null;

  const remaining = NOTE_MAX_LENGTH - draft.length;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Edit ${label}`}
      // React events bubble through portals — keep them away from the task row
      onClick={stop}
      onMouseDown={stop}
      onKeyDown={stop}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: NOTE_PANEL_WIDTH,
        transform: pos.above ? 'translateY(-100%)' : undefined,
      }}
      className="z-[70] rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
    >
      <div className="px-3 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[rgba(17,17,17,0.45)] truncate">
        {label}
      </div>
      <div className="px-3">
        <textarea
          ref={textareaRef}
          autoFocus
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          value={draft}
          placeholder="Write a note about this task"
          aria-label={label}
          onFocus={e => {
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commitRef.current();
            }
          }}
          className="block w-full min-h-[72px] resize-none rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[13px] leading-relaxed text-[#111111] placeholder-[#9CA3AF] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className={`text-[11px] tabular-nums ${remaining <= 50 ? 'text-[#D97706]' : 'text-[rgba(17,17,17,0.4)]'}`}>
          {draft.length}/{NOTE_MAX_LENGTH}
        </span>
        <span className="hidden sm:inline text-[11px] text-[rgba(17,17,17,0.4)]">Ctrl+Enter to save</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-2.5 rounded-md text-[12px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => commitRef.current()}
            className="h-7 px-3 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-medium transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
