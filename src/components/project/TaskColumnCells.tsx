'use client';

import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
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
        <div className="w-full min-w-0" onClick={stop}>
          <InlineInput
            ariaLabel={label}
            display={text || EMPTY}
            initial={text}
            placeholder="Add text"
            onCommit={draft => {
              const next = draft.trim().slice(0, 1000);
              if (next !== text) onSave(next === '' ? null : next);
              return true;
            }}
          />
        </div>
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
      return (
        <div
          className="relative flex items-center h-8 min-w-0 w-full px-2 -mx-2 rounded-md hover:bg-[#F3F4F6] transition-colors duration-100 ease-out"
          onClick={stop}
        >
          {current && (
            <span
              className="max-w-full truncate px-2 py-0.5 rounded-md text-[11.5px] font-medium"
              style={{ backgroundColor: tone.bg, color: tone.fg }}
            >
              {current}
            </span>
          )}
          <select
            aria-label={label}
            value={current}
            onChange={e => onSave(e.target.value || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            <option value="">—</option>
            {current && idx < 0 && <option value={current}>{current}</option>}
            {options.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }
  }
}

/**
 * Click-to-pick date (native calendar). `cell` blends into a table row; `field` looks like a form input.
 * Values are YYYY-MM-DD strings.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isField = variant === 'field';

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div className="group/date relative flex items-center h-8 min-w-0 w-full" onClick={stop}>
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={e => {
          stop(e);
          openPicker();
        }}
        className={
          isField
            ? 'flex-1 min-w-0 h-8 pl-2.5 pr-7 rounded-md border border-[#E5E7EB] bg-white text-left text-[12.5px] text-[#111111] truncate hover:border-[#D1D5DB] focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#DBEAFE] outline-none transition-colors cursor-pointer'
            : 'flex-1 min-w-0 h-8 px-2 -mx-2 rounded-md text-left text-[12.5px] text-[rgba(17,17,17,0.75)] truncate hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer'
        }
      >
        {value ? (
          formatShortDate(value)
        ) : isField ? (
          <span className="text-[#9CA3AF]">{placeholder ?? 'Select date'}</span>
        ) : (
          EMPTY
        )}
      </button>
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
      {/* Off-screen native picker; opened from the button above */}
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => onSave(e.target.value || null)}
        className="absolute left-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
