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
import { useSession } from 'next-auth/react';
import { SelectMenu, type SelectOption } from '@/components/ui/Pickers';
import { DateField, TimeSpentCell } from '@/components/project/TaskColumnCells';
import { toDateInputValue } from '@/lib/taskColumns';

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

/**
 * Task table grid — same columns as the project task table, plus Project (and Due date, since
 * this list is not grouped by date). Phones get a narrower pinned Task column and swipe sideways.
 */
const MT_TRACKS = ['8rem', '7.5rem', '6.5rem', '7rem', '7rem', '7.5rem', '5.5rem', '2.5rem'];
const MT_REST_REM = 8 + 7.5 + 6.5 + 7 + 7 + 7.5 + 5.5 + 2.5 + MT_TRACKS.length * 0.75;
const GRID_VARS = {
  '--mt-cols': ['minmax(11rem,1fr)', ...MT_TRACKS].join(' '),
  '--mt-min': `${11 + MT_REST_REM + 2.5}rem`,
  '--mt-cols-sm': ['minmax(10rem,1fr)', ...MT_TRACKS].join(' '),
  '--mt-min-sm': `${10 + MT_REST_REM + 2}rem`,
} as React.CSSProperties;
const MT_GRID =
  'grid [grid-template-columns:var(--mt-cols-sm)] md:[grid-template-columns:var(--mt-cols)] items-center gap-x-3';
const MT_ROW_PAD = 'px-4 md:px-5';
/** Pinned Task cell: covers the row gutter, takes the row background, soft edge once scrolled */
const MT_PINNED =
  'sticky left-0 z-[1] -ml-4 pl-4 md:-ml-5 md:pl-5 self-stretch flex items-center min-w-0 bg-inherit transition-shadow duration-150 ease-out group-data-[scrolled=true]/tbl:shadow-[6px_0_8px_-6px_rgba(17,17,17,0.14)]';
/** Table-cell look for the Status / Priority menus */
const CELL_TRIGGER =
  'w-full min-w-0 h-8 px-2 -mx-2 inline-flex items-center rounded-md text-left hover:bg-[#F3F4F6] transition-colors duration-100 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#DBEAFE]';

const STATUS_OPTIONS: SelectOption<Status>[] = (['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const).map(s => ({
  value: s,
  label: statusColors[s].label,
}));
const PRIORITY_OPTIONS: SelectOption<Priority>[] = (['low', 'medium', 'high', 'urgent'] as const).map(p => ({
  value: p,
  label: priorityColors[p].label,
}));

const localDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function MyTasks({ onTaskClick, onCreateTask }: MyTasksProps) {
  const { tasks: allTasks, isLoading, deleteTask, refreshTasks, updateTask } = useTasks();
  const toast = useToast();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  // My Tasks = tasks assigned to me or created by me (the shared list also holds teammates' tasks
  // from projects I belong to). O(N) single pass.
  const tasks = useMemo(
    () => (currentUserId ? allTasks.filter(t => t.assigneeId === currentUserId || t.creatorId === currentUserId) : []),
    [allTasks, currentUserId]
  );
  const todayKey = localDateKey();

  /** Inline edits from the table (optimistic; TaskContext rolls back and toasts on failure) */
  const saveTask = useCallback(
    (task: DBTask, payload: Parameters<typeof updateTask>[1]) => {
      updateTask(task.id, payload).catch(() => {
        /* rollback + toast handled by TaskContext */
      });
    },
    [updateTask]
  );

  /** Sideways-scroll state: pinned-column shadow, right-edge fade, visible width */
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableEdges, setTableEdges] = useState({ scrolled: false, more: false, width: 0 });
  const updateTableEdges = useCallback(() => {
    const el = tableRef.current;
    if (!el) return;
    const next = {
      scrolled: el.scrollLeft > 2,
      more: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      width: el.clientWidth,
    };
    setTableEdges(prev => (prev.scrolled === next.scrolled && prev.more === next.more && prev.width === next.width ? prev : next));
  }, []);
  useEffect(() => {
    const el = tableRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    updateTableEdges();
    const ro = new ResizeObserver(updateTableEdges);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [updateTableEdges]);
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
              {isLoading && tasks.length === 0
                ? 'Loading tasks...'
                : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} assigned to or created by you`}
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
                className={`px-2.5 md:px-3 py-1.5 md:py-1 rounded-md text-[12px] md:text-[12.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${statusFilter === s.value
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

        {/* ── Task table (all screens): swipes sideways on small screens, Task column pinned ── */}
        <div className="relative rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div
            ref={tableRef}
            onScroll={updateTableEdges}
            data-scrolled={tableEdges.scrolled}
            className="group/tbl overflow-x-auto overscroll-x-contain"
          >
            <div className="min-w-[var(--mt-min-sm)] md:min-w-[var(--mt-min)]" style={GRID_VARS}>
              {/* Column header */}
              <div className={`${MT_GRID} h-10 ${MT_ROW_PAD} border-b border-[#E5E7EB] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wide text-[rgba(17,17,17,0.45)]`}>
                <div className={`${MT_PINNED} gap-2.5`}>
                  <input
                    type="checkbox"
                    aria-label="Select all tasks"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    ref={el => {
                      if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length;
                    }}
                    onChange={selectAll}
                    disabled={filtered.length === 0}
                    className="w-3.5 h-3.5 rounded border-[#D1D5DB] accent-[#2563EB] cursor-pointer shrink-0"
                  />
                  <span>Task</span>
                </div>
                <span>Project</span>
                <span>Status</span>
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
                  className="flex items-center gap-1.5 min-w-0 uppercase tracking-wide hover:text-[#111111] transition-colors text-left cursor-pointer"
                  title="Click to cycle priority sort: Urgent → High → Medium → Low → Default"
                >
                  <span>Priority</span>
                  {sortMode !== 'none' && (
                    <span className="text-[10.5px] font-semibold capitalize text-[#2563EB] normal-case">{sortMode}</span>
                  )}
                </button>
                <span>Assignee</span>
                <span>Due date</span>
                <span className="truncate">Completion date</span>
                <span>Time spent</span>
                <span aria-hidden="true" />
              </div>

              {isLoading && tasks.length === 0 ? (
                <div>
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                  <TaskRowSkeleton />
                </div>
              ) : filtered.length === 0 ? (
                <div className="sticky left-0" style={{ width: tableEdges.width ? `${tableEdges.width}px` : '100%' }}>
                  <EmptyState
                    title="No tasks found"
                    description={
                      search || statusFilter !== 'all'
                        ? 'Try adjusting your filters or search query'
                        : 'Tasks assigned to you or created by you will appear here'
                    }
                    action={!search && statusFilter === 'all' ? { label: 'Create Task', onClick: onCreateTask } : undefined}
                  />
                </div>
              ) : (
                filtered.map(task => {
                  const status = sc(task.status);
                  const isDone = task.status === 'done';
                  const isSelected = selected.has(task.id);
                  const overdue = !isDone && task.dueDate && task.dueDate < todayKey;
                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onTaskClick(task.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) onTaskClick(task.id);
                      }}
                      className={`${MT_GRID} relative min-h-12 py-2 ${MT_ROW_PAD} border-t border-[#F3F4F6] first:border-t-0 cursor-pointer outline-none transition-colors duration-100 ease-out ${
                        isSelected ? 'bg-[#F5F8FF] hover:bg-[#EEF3FF]' : 'bg-white hover:bg-[#FAFAFA] focus-visible:bg-[#FAFAFA]'
                      } ${activeRowMenuId === task.id ? 'z-30' : ''}`}
                    >
                      {/* Task (pinned) */}
                      <div className={`${MT_PINNED} gap-2.5 -my-2 py-2`}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${task.title}`}
                          checked={isSelected}
                          onClick={e => e.stopPropagation()}
                          onChange={() =>
                            setSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(task.id)) next.delete(task.id);
                              else next.add(task.id);
                              return next;
                            })
                          }
                          className="w-3.5 h-3.5 rounded border-[#D1D5DB] accent-[#2563EB] cursor-pointer shrink-0"
                        />
                        <span
                          className={`truncate text-[13.5px] ${isDone ? 'line-through text-[rgba(17,17,17,0.4)]' : 'text-[#111111] font-medium'}`}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Project */}
                      <span className="truncate text-[12.5px] text-[rgba(17,17,17,0.7)]" title={task.project?.name ?? undefined}>
                        {task.project?.name ?? <span className="text-[rgba(17,17,17,0.35)]">No project</span>}
                      </span>

                      {/* Status (editable) */}
                      <div className="min-w-0" onClick={e => e.stopPropagation()}>
                        <SelectMenu
                          ariaLabel={`Status of ${task.title}`}
                          value={(task.status in statusColors ? task.status : 'todo') as Status}
                          options={STATUS_OPTIONS}
                          onChange={v => v && v !== task.status && saveTask(task, { status: v })}
                          triggerClassName={CELL_TRIGGER}
                          renderValue={() => (
                            <span
                              className="inline-block max-w-full truncate px-2 py-0.5 rounded-md text-[11.5px] font-medium"
                              style={{ backgroundColor: status.bg, color: status.text }}
                            >
                              {status.label}
                            </span>
                          )}
                        />
                      </div>

                      {/* Priority (editable) */}
                      <div className="min-w-0" onClick={e => e.stopPropagation()}>
                        <SelectMenu
                          ariaLabel={`Priority of ${task.title}`}
                          value={(task.priority in priorityColors ? task.priority : 'medium') as Priority}
                          options={PRIORITY_OPTIONS}
                          onChange={v => v && v !== task.priority && saveTask(task, { priority: v })}
                          triggerClassName={CELL_TRIGGER}
                          renderValue={() => (
                            <span className="truncate text-[12.5px] text-[rgba(17,17,17,0.75)]">{pc(task.priority).label}</span>
                          )}
                        />
                      </div>

                      {/* Assignee */}
                      <span className="flex items-center gap-2 min-w-0">
                        {task.assignee ? (
                          <>
                            <span className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
                              {task.assignee.avatar?.startsWith('http') || task.assignee.avatar?.startsWith('/') ? (
                                <img src={task.assignee.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                (task.assignee.avatar && task.assignee.avatar.length <= 3 ? task.assignee.avatar : task.assignee.name.slice(0, 2)).toUpperCase()
                              )}
                            </span>
                            <span className="truncate text-[12.5px] text-[rgba(17,17,17,0.7)]">
                              {task.assignee.id === currentUserId ? 'You' : task.assignee.name.split(' ')[0]}
                            </span>
                          </>
                        ) : (
                          <span className="text-[12.5px] text-[rgba(17,17,17,0.35)]">Unassigned</span>
                        )}
                      </span>

                      {/* Due date (editable) */}
                      <span className={`flex min-w-0 ${overdue ? '[&_button]:text-[#DC2626]' : ''}`}>
                        <DateField
                          label={`due date for ${task.title}`}
                          value={task.dueDate || null}
                          onSave={value => saveTask(task, { dueDate: value ?? '' })}
                        />
                      </span>

                      {/* Completion date (editable) */}
                      <span className="flex min-w-0">
                        <DateField
                          label={`completion date for ${task.title}`}
                          value={toDateInputValue(task.completedAt) || null}
                          onSave={value => saveTask(task, { completedAt: value })}
                        />
                      </span>

                      {/* Time spent (editable) */}
                      <span className="flex min-w-0">
                        <TimeSpentCell
                          minutes={task.timeSpent}
                          taskTitle={task.title}
                          onSave={minutes => saveTask(task, { timeSpent: minutes })}
                        />
                      </span>

                      {/* Row menu */}
                      <span className="flex justify-end" onClick={e => e.stopPropagation()}>
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
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* "More to the right" hint while columns are hidden past the right edge */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-150 ease-out ${
              tableEdges.more ? 'opacity-100' : 'opacity-0'
            }`}
          />
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
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md overflow-y-auto animate-in fade-in duration-150 p-6 max-h-[calc(100dvh-2rem)] overscroll-contain"
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
