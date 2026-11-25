'use client';

/**
 * Sidebar workspace switcher: the open workspace, a list of every workspace the person belongs to
 * (Personal first, then companies), and "Create a team".
 */

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useWorkspaces, type WorkspaceInfo } from '@/lib/useWorkspaces';

function subtitle(w: WorkspaceInfo): string {
  if (w.kind === 'company') return w.role;
  if (w.state === 'free') return 'Free';
  if (w.state === 'expired') return 'Trial ended';
  return w.daysLeft != null ? `Trial · ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} left` : 'Free trial';
}

function Mark({ w, size = 24 }: { w: Pick<WorkspaceInfo, 'name' | 'kind'>; size?: number }) {
  const letter = w.kind === 'personal' ? 'P' : (w.name.trim()[0] || '?').toUpperCase();
  return (
    <span
      className={`shrink-0 rounded-md flex items-center justify-center text-[11px] font-semibold ${
        w.kind === 'personal' ? 'bg-[#F3F4F6] text-[#4B5563]' : 'bg-[#EFF6FF] text-[#2563EB]'
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export default function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspaces, current, switchTo, loaded, reload } = useWorkspaces();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = async (id: string, goTo?: string) => {
    setBusy(id);
    setError(null);
    try {
      await switchTo(id, goTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t switch workspace.');
      setBusy(null);
    }
  };

  const createTeam = () => {
    // A new team is created from the Personal workspace (its plan is chosen there)
    if (current?.kind === 'personal') window.location.assign('/onboarding/plans');
    else go('personal', '/onboarding/plans');
  };

  const label = current ?? (loaded ? null : { name: '…', kind: 'company' as const });

  return (
    <div ref={ref} className="relative px-2 pt-2">
      <button
        type="button"
        onClick={() => {
          if (!open && workspaces.length === 0) reload();
          setOpen(o => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed && current ? current.name : undefined}
        className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE] ${
          collapsed ? 'md:justify-center md:px-0' : ''
        }`}
      >
        {label ? <Mark w={label} /> : <span className="w-6 h-6 rounded-md bg-[#F3F4F6]" />}
        <span className={`flex-1 min-w-0 text-left ${collapsed ? 'md:hidden' : ''}`}>
          <span className="block truncate text-[13px] font-medium text-[#111111]">{current?.name ?? 'Workspace'}</span>
          {current && <span className="block truncate text-[11px] text-[rgba(17,17,17,0.5)]">{subtitle(current)}</span>}
        </span>
        <ChevronsUpDown size={14} className={`shrink-0 text-[#9CA3AF] ${collapsed ? 'md:hidden' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 md:right-auto md:w-[232px] top-full mt-1 z-50 rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-[0_12px_32px_-8px_rgba(17,17,17,0.18)]"
        >
          <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-[rgba(17,17,17,0.45)]">Workspaces</p>
          {workspaces.map(w => {
            const active = current?.id === w.id || (w.id === 'personal' && current?.kind === 'personal');
            return (
              <button
                key={w.id}
                type="button"
                role="menuitem"
                disabled={busy !== null}
                onClick={() => (active ? setOpen(false) : go(w.kind === 'personal' ? 'personal' : w.id))}
                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer disabled:cursor-default"
              >
                <Mark w={w} size={22} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[13px] text-[#111111]">{w.name}</span>
                  <span className="block truncate text-[11px] text-[rgba(17,17,17,0.5)]">{subtitle(w)}</span>
                </span>
                {busy === (w.kind === 'personal' ? 'personal' : w.id) ? (
                  <Loader2 size={14} className="animate-spin text-[#9CA3AF]" />
                ) : active ? (
                  <Check size={14} className="text-[#2563EB]" />
                ) : null}
              </button>
            );
          })}
          <div className="my-1 h-px bg-[#F0F0F0]" />
          <button
            type="button"
            role="menuitem"
            disabled={busy !== null}
            onClick={createTeam}
            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-[rgba(17,17,17,0.75)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors duration-100 ease-out cursor-pointer"
          >
            <span className="w-[22px] h-[22px] rounded-md border border-dashed border-[#D1D5DB] flex items-center justify-center">
              <Plus size={12} />
            </span>
            Create a team
          </button>
          {error && <p className="px-2 pb-1.5 pt-1 text-[12px] text-[#DC2626]">{error}</p>}
        </div>
      )}
    </div>
  );
}
