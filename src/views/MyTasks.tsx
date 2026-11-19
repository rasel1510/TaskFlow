'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import EditTaskModal from '@/components/EditTaskModal';
import { statusColors, priorityColors, type Status, type Priority } from '../data/mockData';
import { useToast } from '@/components/ui/Toast';
import { TaskRowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import gsap from 'gsap';
import { RadialTaskMenu } from '@/components/RadialTaskMenu';
import { triggerParticleExplosion } from '@/lib/particleExplosion';

type SortMode = 'none' | 'urgent' | 'high' | 'medium' | 'low';

interface MyTasksProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
}

const statuses: { value: Status | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch {
    return d;

  }
}

export default function MyTasks({ onTaskClick, onCreateTask }: MyTasksProps) {
  const { tasks, isLoading, deleteTask, refreshTasks } = useTasks();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatusMenu, setBulkStatusMenu] = useState(false);
  const [bulkPriorityMenu, setBulkPriorityMenu] = useState(false);

  // Task mutation states
  const [editingTask, setEditingTask] = useState<DBTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<DBTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  // Initialize GSAP dropdown animation (elastic panel, elastic arrow, stagger items)
  const initDD = useCallback(() => {
    if (!menuRef.current || !arrowRef.current) return;
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const menu = menuRef.current;
    const arrow = arrowRef.current;
    const items = menu.querySelectorAll('.dropdown-item');

    gsap.set(menu, { autoAlpha: 0, yPercent: -15, scale: 0.85, transformOrigin: 'top right' });
    gsap.set(arrow, { rotation: 0, transformOrigin: 'center center' });
    gsap.set(items, { opacity: 1, x: 0 });
    menu.classList.remove('open');

    const tl = gsap.timeline({ paused: true });

    tl.to(arrow, {
      rotation: 180,
      duration: 0.9,
      ease: 'elastic.out(1.2, 0.3)',
    }, 0)
      .to(menu, {
        autoAlpha: 1,
        yPercent: 0,
        scale: 1,
        duration: 1,
        ease: 'elastic.out(1.2, 0.3)',
      }, 0)
      .from(items, {
        opacity: 0,
        x: -20,
        duration: 0.5,
        ease: 'back.out(3)',
        stagger: 0.07,
      }, 0.1);

    timelineRef.current = tl;
  }, []);

  useEffect(() => {
    initDD();
    return () => {
      timelineRef.current?.kill();
    };
  }, [initDD]);

  const toggleDropdown = useCallback((open: boolean) => {
    const tl = timelineRef.current;
    const menu = menuRef.current;
    if (!tl || !menu) return;

    if (open) {
      setSortMenuOpen(true);
      menu.classList.add('open');
      tl.timeScale(1).play();
    } else {
      setSortMenuOpen(false);
      tl.eventCallback('onReverseComplete', () => {
        menu.classList.remove('open');
      });
      tl.timeScale(2.5).reverse();
    }
  }, []);

  const handleSelectSort = useCallback((mode: SortMode) => {
    setSortMode(prev => (prev === mode ? 'none' : mode));
    toggleDropdown(false);
  }, [toggleDropdown]);

  // Close sort menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        if (sortMenuOpen) {
          toggleDropdown(false);
        }
      }
    };
    if (sortMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortMenuOpen, toggleDropdown]);

  // Close active radial action menu on click outside or Escape
  useEffect(() => {
    const handleDocClick = () => {
      setActiveRowMenuId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveRowMenuId(null);
      }
    };
    if (activeRowMenuId) {
      document.addEventListener('click', handleDocClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRowMenuId]);

  const filtered: DBTask[] = useMemo(() => {
    const list = tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    if (sortMode === 'none') {
      return list;
    }

    return [...list].sort((a, b) => {
      const pA = (a.priority || '').toLowerCase().trim();
      const pB = (b.priority || '').toLowerCase().trim();

      let scoreA = 0;
      let scoreB = 0;

      if (sortMode === 'urgent') {
        // Urgent priority first: urgent (4) -> high (3) -> medium (2) -> low (1)
        const weights: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        scoreA = weights[pA] ?? 0;
        scoreB = weights[pB] ?? 0;
      } else if (sortMode === 'high') {
        // High priority first: high (4) -> urgent (3) -> medium (2) -> low (1)
        const weights: Record<string, number> = { high: 4, urgent: 3, medium: 2, low: 1 };
        scoreA = weights[pA] ?? 0;
        scoreB = weights[pB] ?? 0;
      } else if (sortMode === 'medium') {
        // Medium priority first: medium (4) -> high (3) -> urgent (2) -> low (1)
        const weights: Record<string, number> = { medium: 4, high: 3, urgent: 2, low: 1 };
        scoreA = weights[pA] ?? 0;
        scoreB = weights[pB] ?? 0;
      } else if (sortMode === 'low') {
        // Low priority first: low (4) -> medium (3) -> high (2) -> urgent (1)
        const weights: Record<string, number> = { low: 4, medium: 3, high: 2, urgent: 1 };
        scoreA = weights[pA] ?? 0;
        scoreB = weights[pB] ?? 0;
      }

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Tie-breakers: due date then title
      if (a.dueDate && b.dueDate) {
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (diff !== 0) return diff;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }

      return (a.title || '').localeCompare(b.title || '');
    });
  }, [tasks, statusFilter, search, sortMode]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => t.id)));
    }
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    const targetId = taskToDelete.id;

    // Instant optimistic dismissal (<1ms perceived latency!)
    setTaskToDelete(null);
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    // Delete in background with automatic snapshot rollback if network fails
    deleteTask(targetId).catch(err => {
      console.error('Delete task failed in background:', err);
    });
  };

  const handleBulkAction = useCallback(async (
    action: 'delete' | 'update',
    payload?: { status?: string; priority?: string }
  ) => {
    if (selected.size === 0) return;
    if (action === 'delete') {
      const ok = window.confirm(`Delete ${selected.size} selected task(s)? This cannot be undone.`);
      if (!ok) return;

      const idsToDelete = Array.from(selected);
      // Instant optimistic UI update (<1ms perceived latency)
      setSelected(new Set());
      setBulkStatusMenu(false);
      setBulkPriorityMenu(false);
      toast.success(`🗑️ Deleted ${idsToDelete.length} task${idsToDelete.length !== 1 ? 's' : ''}`);

      // Optimistically delete tasks in background
      idsToDelete.forEach(id => {
        deleteTask(id).catch(err => {
          console.error('[BulkDelete] Background task delete error:', err);
        });
      });
      return;
    }

    setBulkLoading(true);
    setBulkStatusMenu(false);
    setBulkPriorityMenu(false);
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action, payload }),
      });
      const data = await res.json();
      if (data.success) {
        const countMsg = `${data.data?.count ?? selected.size} task${(data.data?.count ?? selected.size) !== 1 ? 's' : ''}`;
        toast.success(`✅ Updated ${countMsg}`);
        setSelected(new Set());
        if (typeof refreshTasks === 'function') await refreshTasks();
      } else {
        toast.error(data.error?.message || 'Bulk operation failed');
      }
    } catch {
      toast.error('Network error during bulk operation');
    } finally {
      setBulkLoading(false);
    }
  }, [selected, toast, refreshTasks, deleteTask]);

  // Legacy single-task delete
  const handleBulkDelete = () => handleBulkAction('delete');

  // Safe status/priority color helpers
  const sc = (s: string) => {
    const key = (s in statusColors ? s : 'todo') as Status;
    return statusColors[key];
  };
  const pc = (p: string) => {
    const key = (p in priorityColors ? p : 'medium') as Priority;
    return priorityColors[key];
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-bold text-[#111111]">My Tasks</h1>
            <p className="text-[12px] md:text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">
              {isLoading && tasks.length === 0 ? 'Loading tasks...' : `${tasks.length} total tasks`}
            </p>
          </div>
          <button
            onClick={onCreateTask}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] md:text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4 md:mb-5">
          <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-lg bg-[#F9FAFB] focus-within:bg-white focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all flex-1 shadow-2xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none border-none focus:outline-none focus:ring-0 w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#E5E7EB] transition-colors shrink-0"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Status tabs — horizontal scroll on mobile */}
          <div className="flex items-center gap-0.5 p-0.5 bg-[#F3F4F6] rounded-lg overflow-x-auto no-scrollbar shrink-0">
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value as Status | 'all')}
                className={`px-2.5 md:px-3 py-1 rounded-md text-[12px] md:text-[12.5px] font-medium transition-colors whitespace-nowrap ${statusFilter === s.value
                    ? 'bg-white text-[#111111] shadow-sm'
                    : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Sort Button & Motion Dropdown Menu */}
          <div className="dropdown-wrap relative flex items-center text-[12.5px]" ref={sortMenuRef}>
            <div className={`flex items-center rounded-lg border transition-all ${sortMode !== 'none'
                ? 'border-[#CBD5E1] bg-[#F8FAFC] text-[#111111]'
                : 'border-[#E5E7EB] bg-white text-[rgba(17,17,17,0.7)] hover:text-[#111111] hover:border-[#CBD5E1] hover:bg-[#F9FAFB]'
              }`}>
              <button
                type="button"
                onClick={() => toggleDropdown(!sortMenuOpen)}
                className="dropdown-trigger flex items-center gap-2 px-3 py-1.5 font-medium cursor-pointer"
                aria-expanded={sortMenuOpen}
                aria-haspopup="true"
                aria-label="Sort tasks by priority"
              >
                <span className={sortMode !== 'none' ? 'capitalize font-medium' : ''}>
                  {sortMode === 'none' ? 'Sort' : `Sort: ${sortMode}`}
                </span>
                <svg
                  ref={arrowRef}
                  className="dd-arrow shrink-0"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {sortMode !== 'none' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortMode('none');
                    if (sortMenuOpen) toggleDropdown(false);
                  }}
                  className="px-2 py-1.5 border-l border-[#CBD5E1] hover:bg-[#F1F5F9] transition-colors cursor-pointer text-[rgba(17,17,17,0.5)] hover:text-[#111111]"
                  title="Clear sort"
                  aria-label="Clear sort"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Motion Dropdown Menu */}
            <div
              ref={menuRef}
              className="dropdown-menu absolute right-0 top-[calc(100%+6px)] w-36 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-1 overflow-hidden"
            >
              {/* Low */}
              <button
                type="button"
                onClick={() => handleSelectSort('low')}
                className={`dropdown-item w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between hover:bg-[#F3F4F6] transition-colors cursor-pointer ${sortMode === 'low' ? 'text-[#111111] font-semibold bg-[#F3F4F6]' : 'text-[rgba(17,17,17,0.7)] hover:text-[#111111]'
                  }`}
              >
                <span>Low</span>
                {sortMode === 'low' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>

              {/* Medium */}
              <button
                type="button"
                onClick={() => handleSelectSort('medium')}
                className={`dropdown-item w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between hover:bg-[#F3F4F6] transition-colors cursor-pointer ${sortMode === 'medium' ? 'text-[#111111] font-semibold bg-[#F3F4F6]' : 'text-[rgba(17,17,17,0.7)] hover:text-[#111111]'
                  }`}
              >
                <span>Medium</span>
                {sortMode === 'medium' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>

              {/* High */}
              <button
                type="button"
                onClick={() => handleSelectSort('high')}
                className={`dropdown-item w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between hover:bg-[#F3F4F6] transition-colors cursor-pointer ${sortMode === 'high' ? 'text-[#111111] font-semibold bg-[#F3F4F6]' : 'text-[rgba(17,17,17,0.7)] hover:text-[#111111]'
                  }`}
              >
                <span>High</span>
                {sortMode === 'high' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>

              {/* Urgent */}
              <button
                type="button"
                onClick={() => handleSelectSort('urgent')}
                className={`dropdown-item w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between hover:bg-[#F3F4F6] transition-colors cursor-pointer ${sortMode === 'urgent' ? 'text-[#111111] font-semibold bg-[#F3F4F6]' : 'text-[rgba(17,17,17,0.7)] hover:text-[#111111]'
                  }`}
              >
                <span>Urgent</span>
                {sortMode === 'urgent' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk actions — floating toolbar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 mb-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl shadow-sm">
            <span className="text-[13px] font-semibold text-[#2563EB]">{selected.size} selected</span>
            <div className="flex items-center gap-1.5 ml-2 flex-wrap">

              {/* Status Change */}
              <div className="relative">
                <button
                  disabled={bulkLoading}
                  onClick={() => { setBulkStatusMenu(v => !v); setBulkPriorityMenu(false); }}
                  className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[#BFDBFE] text-[#2563EB] hover:bg-white transition-colors font-medium"
                >
                  Change Status ▾
                </button>
                {bulkStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 min-w-[160px] py-1">
                    {['backlog', 'todo', 'in_progress', 'in_review', 'done'].map(s => (
                      <button key={s} onClick={() => handleBulkAction('update', { status: s })}
                        className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#F3F4F6] capitalize">
                        {s.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Change */}
              <div className="relative">
                <button
                  disabled={bulkLoading}
                  onClick={() => { setBulkPriorityMenu(v => !v); setBulkStatusMenu(false); }}
                  className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[#BFDBFE] text-[#2563EB] hover:bg-white transition-colors font-medium"
                >
                  Change Priority ▾
                </button>
                {bulkPriorityMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 min-w-[140px] py-1">
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <button key={p} onClick={() => handleBulkAction('update', { priority: p })}
                        className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#F3F4F6] capitalize">
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk Delete */}
              <button
                disabled={bulkLoading}
                onClick={handleBulkDelete}
                className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors font-medium"
              >
                {bulkLoading ? 'Working...' : 'Delete Selected'}
              </button>
            </div>
            <button
              onClick={() => { setSelected(new Set()); setBulkStatusMenu(false); setBulkPriorityMenu(false); }}
              className="ml-auto text-[12.5px] text-[#6B7280] hover:text-[#111111]"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* ── Desktop Table ── */}
        <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-xl">
          {/* Table header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] rounded-t-xl text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
            <span className="flex-1">Task</span>
            <span className="w-32">Project</span>
            <span className="w-28">Status</span>
            <button
              type="button"
              onClick={() => {
                setSortMode(prev => {
                  if (prev === 'none') return 'urgent';
                  if (prev === 'urgent') return 'high';
                  if (prev === 'high') return 'medium';
                  if (prev === 'medium') return 'low';
                  return 'none';
                });
              }}
              className="w-24 flex items-center gap-1.5 hover:text-[#111111] transition-colors text-left uppercase tracking-wide cursor-pointer group"
              title="Click to cycle priority sort: Urgent → High → Medium → Low → Default"
            >
              <span>Priority</span>
              {sortMode === 'urgent' && <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" />}
              {sortMode === 'high' && <span className="w-2 h-2 rounded-full bg-[#EA580C] shrink-0" />}
              {sortMode === 'medium' && <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />}
              {sortMode === 'low' && <span className="w-2 h-2 rounded-full bg-[#6B7280] shrink-0" />}
              {sortMode === 'none' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity">
                  <path d="M7 15l5 5 5-5" />
                  <path d="M7 9l5-5 5 5" />
                </svg>
              )}
            </button>
            <span className="w-28">Assignee</span>
            <span className="w-28">Due Date</span>
            <span className="w-16">Est.</span>
            <span className="w-20 text-right pr-2">Actions</span>
          </div>

          {/* Desktop Rows */}
          {isLoading && tasks.length === 0 ? (
            <div>
              <TaskRowSkeleton />
              <TaskRowSkeleton />
              <TaskRowSkeleton />
              <TaskRowSkeleton />
              <TaskRowSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No tasks found"
              description={search || statusFilter !== 'all' ? 'Try adjusting your filters or search query' : 'Create your first task to start organizing work'}
              action={!search && statusFilter === 'all' ? { label: 'Create Task', onClick: onCreateTask } : undefined}
            />
          ) : (
            filtered.map((task, i) => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[#F9FAFB] group ${activeRowMenuId === task.id ? 'z-30 relative' : 'relative'
                  } ${selected.has(task.id) ? 'bg-[#FAFBFF]' : ''
                  } ${i < filtered.length - 1 ? 'border-b border-[#F3F4F6]' : 'rounded-b-xl'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13.5px] font-medium text-[#111111] truncate ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>{task.title}</span>
                    {task.labels.slice(0, 2).map(label => (
                      <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.5)] shrink-0 hidden group-hover:inline-block">{label}</span>
                    ))}
                  </div>
                </div>
                <span className="w-32 text-[12.5px] text-[rgba(17,17,17,0.6)] truncate">{task.project?.name ?? '—'}</span>
                <div className="w-28">
                  <span className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: sc(task.status).bg, color: sc(task.status).text }}>{sc(task.status).label}</span>
                </div>
                <div className="w-24"><span className="text-[12.5px] text-[rgba(17,17,17,0.7)]">{pc(task.priority).label}</span></div>
                <div className="w-28 flex items-center gap-2">
                  {task.assignee ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
                        {task.assignee.avatar?.startsWith('http') || task.assignee.avatar?.startsWith('/') ? (
                          <img src={task.assignee.avatar} alt={task.assignee.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                          (task.assignee.avatar && task.assignee.avatar.length <= 3 ? task.assignee.avatar : task.assignee.name.slice(0, 2)).toUpperCase()
                        )}
                      </div>
                      <span className="text-[12.5px] text-[rgba(17,17,17,0.7)] truncate">{task.assignee.name.split(' ')[0]}</span>
                    </>
                  ) : <span className="text-[12px] text-[rgba(17,17,17,0.35)]">Unassigned</span>}
                </div>
                <span className="w-28 text-[12.5px] text-[rgba(17,17,17,0.6)]">{formatDate(task.dueDate)}</span>
                <span className="w-16 text-[12.5px] text-[rgba(17,17,17,0.5)]">{task.estimate ?? '—'}</span>
                <div className="w-20 flex items-center justify-end pr-1 shrink-0 relative" onClick={e => e.stopPropagation()}>
                  <RadialTaskMenu
                    isOpen={activeRowMenuId === task.id}
                    onToggle={() => setActiveRowMenuId(prev => (prev === task.id ? null : task.id))}
                    onEdit={() => {
                      setEditingTask(task);
                      setActiveRowMenuId(null);
                    }}
                    onDelete={() => {
                      setTaskToDelete(task);
                      setActiveRowMenuId(null);
                    }}
                    taskTitle={task.title}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Mobile Card List ── */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              <TaskRowSkeleton />
              <TaskRowSkeleton />
              <TaskRowSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No tasks found"
              description={search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first task to get started'}
              action={!search && statusFilter === 'all' ? { label: 'Create Task', onClick: onCreateTask } : undefined}
            />
          ) : (
            filtered.map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className={`bg-white border border-[#E5E7EB] rounded-xl px-4 py-3.5 cursor-pointer transition-colors active:bg-[#F9FAFB] ${activeRowMenuId === task.id ? 'z-30 relative' : 'relative'
                  } ${selected.has(task.id) ? 'border-[#93C5FD] bg-[#FAFBFF]' : ''
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-medium text-[#111111] leading-snug ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-[rgba(17,17,17,0.5)] truncate">{task.project?.name ?? '—'}</span>
                    </div>
                  </div>
                  {/* Action button */}
                  <div className="flex items-center justify-end shrink-0 relative pr-1" onClick={e => e.stopPropagation()}>
                    <RadialTaskMenu
                      isOpen={activeRowMenuId === task.id}
                      onToggle={() => setActiveRowMenuId(prev => (prev === task.id ? null : task.id))}
                      onEdit={() => {
                        setEditingTask(task);
                        setActiveRowMenuId(null);
                      }}
                      onDelete={() => {
                        setTaskToDelete(task);
                        setActiveRowMenuId(null);
                      }}
                      taskTitle={task.title}
                    />
                  </div>
                </div>
                {/* Bottom row: status + priority + due date */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ backgroundColor: sc(task.status).bg, color: sc(task.status).text }}>
                    {sc(task.status).label}
                  </span>
                  <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: pc(task.priority).color }}>
                    {pc(task.priority).label}
                  </span>
                  {task.dueDate && (
                    <span className="text-[11px] text-[rgba(17,17,17,0.45)] ml-auto whitespace-nowrap shrink-0">{formatDate(task.dueDate)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]"
          onClick={() => !isDeleting && setTaskToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-[#DC2626] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-semibold text-[#111111]">Delete Task</h3>
                <p className="text-[13px] text-[rgba(17,17,17,0.6)] mt-1.5 leading-relaxed break-words">
                  Are you sure you want to delete <span className="font-semibold text-[#111111]">"{taskToDelete.title}"</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  triggerParticleExplosion(e.currentTarget);
                  handleConfirmDelete();
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#DC2626] text-white rounded-lg text-[13px] font-semibold hover:bg-[#B91C1C] disabled:opacity-40 transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isDeleting && (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
