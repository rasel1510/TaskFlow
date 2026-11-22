'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { CalendarDays, Hash, SquareCheck, SquareChevronDown, Type, X } from 'lucide-react';
import {
  COLUMN_TYPE_META,
  COLUMN_TYPE_ORDER,
  type CustomColumn,
  type CustomColumnType,
} from '@/lib/taskColumns';

const TYPE_ICON: Record<CustomColumnType, { Icon: React.ComponentType<{ className?: string }>; bg: string; fg: string }> = {
  text: { Icon: Type, bg: '#FEF3C7', fg: '#B45309' },
  number: { Icon: Hash, bg: '#FFEDD5', fg: '#C2410C' },
  date: { Icon: CalendarDays, bg: '#F3E8FF', fg: '#7E22CE' },
  checkbox: { Icon: SquareCheck, bg: '#FFE4E6', fg: '#BE123C' },
  dropdown: { Icon: SquareChevronDown, bg: '#DCFCE7', fg: '#15803D' },
};

export interface ColumnDraft {
  type: CustomColumnType;
  title: string;
  options?: string[];
}

// ---------------------------------------------------------------------------
// Shared modal shell
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  titleId,
  onClose,
  children,
  footer,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[460px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 id={titleId} className="text-[15px] font-semibold text-[#111111]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#F0F0F0]">{footer}</div>
      </div>
    </div>
  );
}

const secondaryBtn =
  'h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[13px] font-medium text-[#111111] transition-colors cursor-pointer';
const primaryBtn =
  'h-9 px-3.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

// ---------------------------------------------------------------------------
// Add / edit column
// ---------------------------------------------------------------------------

export function ColumnModal({
  column,
  otherTitles,
  busy = false,
  onSubmit,
  onClose,
}: {
  /** Present → edit mode (type is fixed); absent → add mode */
  column?: CustomColumn;
  /** Titles of the other columns, to prevent duplicates */
  otherTitles: string[];
  busy?: boolean;
  onSubmit: (draft: ColumnDraft) => void;
  onClose: () => void;
}) {
  const isEdit = Boolean(column);
  const titleId = useId();
  const [type, setType] = useState<CustomColumnType>(column?.type ?? 'text');
  const [title, setTitle] = useState(column?.title ?? '');
  const [options, setOptions] = useState<string[]>(column?.options ?? []);
  const [optionDraft, setOptionDraft] = useState('');

  const taken = useMemo(() => new Set(otherTitles.map(t => t.trim().toLowerCase())), [otherTitles]);

  /** Add mode names the column after its type, numbered if that name is taken ("Text", "Text 2", …). */
  const autoTitleFor = (t: CustomColumnType) => {
    const base = COLUMN_TYPE_META[t].label;
    if (!taken.has(base.toLowerCase())) return base;
    let i = 2;
    while (taken.has(`${base} ${i}`.toLowerCase())) i++;
    return `${base} ${i}`;
  };

  const trimmed = isEdit ? title.trim() : autoTitleFor(type);
  const duplicate = isEdit && taken.has(trimmed.toLowerCase());
  const needsOptions = type === 'dropdown';
  const optionsMissing = needsOptions && options.length === 0;
  const canSubmit = trimmed.length > 0 && !duplicate && !optionsMissing && !busy;

  const pickType = (next: CustomColumnType) => setType(next);

  const addOption = () => {
    const value = optionDraft.trim().slice(0, 40);
    if (!value) return;
    if (!options.some(o => o.toLowerCase() === value.toLowerCase()) && options.length < 20) {
      setOptions(prev => [...prev, value]);
    }
    setOptionDraft('');
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ type, title: trimmed, ...(needsOptions ? { options } : {}) });
  };

  return (
    <ModalShell
      title={isEdit ? 'Edit column' : 'Add column'}
      titleId={titleId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className={primaryBtn}>
            {busy ? 'Saving…' : isEdit ? 'Save' : 'Add column'}
          </button>
        </>
      }
    >
      {!isEdit && (
        <div>
          <p className="mb-2 text-[12px] font-medium text-[rgba(17,17,17,0.55)]">Column type</p>
          <div role="radiogroup" aria-label="Column type" className="grid grid-cols-2 gap-2">
            {COLUMN_TYPE_ORDER.map(t => {
              const { Icon, bg, fg } = TYPE_ICON[t];
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickType(t)}
                  onDoubleClick={() => {
                    // Double-click adds right away (dropdowns still need their options first)
                    if (t !== 'dropdown' && !busy) onSubmit({ type: t, title: autoTitleFor(t) });
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors duration-100 ease-out cursor-pointer ${
                    selected
                      ? 'border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]'
                      : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#111111]">{COLUMN_TYPE_META[t].label}</span>
                    <span className="block text-[11.5px] leading-tight text-[rgba(17,17,17,0.5)] truncate">
                      {COLUMN_TYPE_META[t].description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Renaming happens from Edit column; adding just picks a type */}
      {isEdit && (
      <div>
        <label htmlFor={`${titleId}-name`} className="mb-1.5 block text-[12px] font-medium text-[rgba(17,17,17,0.55)]">
          Column name
        </label>
        <input
          id={`${titleId}-name`}
          type="text"
          autoFocus
          maxLength={40}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          aria-invalid={duplicate}
          className={`w-full h-9 px-3 rounded-lg border bg-white text-[13px] text-[#111111] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-2 ${
            duplicate
              ? 'border-[#DC2626] focus:ring-[#FEE2E2]'
              : 'border-[#E5E7EB] focus:border-[#2563EB] focus:ring-[#DBEAFE]'
          }`}
        />
        {duplicate && <p className="mt-1.5 text-[12px] text-[#DC2626]">A column with this name already exists.</p>}
      </div>
      )}

      {needsOptions && (
        <div>
          <label htmlFor={`${titleId}-opt`} className="mb-1.5 block text-[12px] font-medium text-[rgba(17,17,17,0.55)]">
            Options
          </label>
          <div className="flex gap-2">
            <input
              id={`${titleId}-opt`}
              type="text"
              maxLength={40}
              value={optionDraft}
              placeholder="Type an option and press Enter"
              onChange={e => setOptionDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  addOption();
                }
              }}
              className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
            />
            <button type="button" onClick={addOption} disabled={!optionDraft.trim()} className={`${secondaryBtn} disabled:opacity-50 disabled:cursor-not-allowed`}>
              Add
            </button>
          </div>
          {options.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {options.map(o => (
                <li
                  key={o}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md bg-[#F3F4F6] text-[12.5px] text-[#111111]"
                >
                  {o}
                  <button
                    type="button"
                    aria-label={`Remove option ${o}`}
                    onClick={() => setOptions(prev => prev.filter(x => x !== o))}
                    className="p-0.5 rounded text-[#9CA3AF] hover:text-[#111111] hover:bg-white transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12px] text-[rgba(17,17,17,0.45)]">Add at least one option.</p>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Delete column
// ---------------------------------------------------------------------------

export function DeleteColumnDialog({
  column,
  busy = false,
  onConfirm,
  onClose,
}: {
  column: CustomColumn;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <ModalShell
      title="Delete column"
      titleId={titleId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-9 px-3.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? 'Deleting…' : 'Delete column'}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-[rgba(17,17,17,0.7)]">
        Delete <span className="font-medium text-[#111111]">“{column.title}”</span> from this project? Its values will
        no longer be shown on any task. Tasks themselves are not affected.
      </p>
    </ModalShell>
  );
}
