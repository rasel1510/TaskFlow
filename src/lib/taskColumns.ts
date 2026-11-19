/**
 * src/lib/taskColumns.ts
 *
 * Shared types and helpers for the project task table's extra columns:
 * system columns (Completion date, Time spent) and project-defined custom columns.
 */

export type CustomColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'dropdown';

export interface CustomColumn {
  id: string;
  type: CustomColumnType;
  title: string;
  /** Dropdown choices */
  options?: string[];
}

export type CustomFieldValue = string | number | boolean | null;
export type CustomFields = Record<string, CustomFieldValue>;

export const MAX_CUSTOM_COLUMNS = 20;

export const COLUMN_TYPE_META: Record<
  CustomColumnType,
  { label: string; description: string; track: string; rem: number }
> = {
  text: { label: 'Text', description: 'Notes or short answers', track: '9rem', rem: 9 },
  number: { label: 'Numbers', description: 'Budgets, counts, scores', track: '6rem', rem: 6 },
  date: { label: 'Date', description: 'Any calendar date', track: '7rem', rem: 7 },
  checkbox: { label: 'Checkbox', description: 'A simple yes / no', track: '6rem', rem: 6 },
  dropdown: { label: 'Dropdown', description: 'Pick from your own list', track: '8rem', rem: 8 },
};

export const COLUMN_TYPE_ORDER: CustomColumnType[] = ['text', 'number', 'date', 'checkbox', 'dropdown'];

/** Ids must match the server's /^col_[a-z0-9]{4,24}$/ */
export function newColumnId(): string {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `col_${rand}`;
}

// ---------------------------------------------------------------------------
// Time spent — typed and shown in hours, stored as whole minutes
// ---------------------------------------------------------------------------

const MAX_MINUTES = 525_600; // one year

/** 6 → "0.1", 90 → "1.5", 120 → "2" (the number only, for editors) */
export function hoursDraft(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  return String(Math.round((Math.max(0, minutes) / 60) * 100) / 100);
}

/** 6 → "0.1 hours", 60 → "1 hour", 90 → "1.5 hours" */
export function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  const value = Math.round((Math.max(0, minutes) / 60) * 100) / 100;
  return `${value} ${value === 1 ? 'hour' : 'hours'}`;
}

/**
 * Parses a time entry into minutes. A bare number means HOURS:
 *   "0.1" → 6 min, "2" → 120 min, "1.5h" → 90 min, "30m" → 30 min, "1:30" → 90 min
 * Returns `null` for an empty string (clear the value) and `undefined` if it can't be read.
 */
export function parseHours(input: string): number | null | undefined {
  const text = input.trim().toLowerCase().replace(',', '.');
  if (!text) return null;

  let minutes: number | undefined;

  const clock = text.match(/^(\d{1,4}):([0-5]?\d)$/);
  if (clock) {
    minutes = Number(clock[1]) * 60 + Number(clock[2]);
  } else if (/^\d*\.?\d+$/.test(text)) {
    minutes = Number(text) * 60;
  } else {
    const parts = text.match(/^(?:(\d*\.?\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d*\.?\d+)\s*m(?:in(?:ute)?s?)?)?$/);
    if (parts && (parts[1] || parts[2])) {
      minutes = Number(parts[1] || 0) * 60 + Number(parts[2] || 0);
    }
  }

  if (minutes === undefined || !Number.isFinite(minutes)) return undefined;
  const rounded = Math.round(minutes);
  return rounded > MAX_MINUTES ? undefined : rounded;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "Nov 8" (adds the year when it isn't the current year). Accepts ISO strings or YYYY-MM-DD. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

/** ISO timestamp or YYYY-MM-DD → the local YYYY-MM-DD used by <input type="date"> ("" if empty/invalid). */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
