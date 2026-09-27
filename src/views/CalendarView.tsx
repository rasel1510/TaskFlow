'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import {
  statusColors,
  priorityColors,
  type Status,
  type Priority,
} from '@/data/mockData';

interface CalendarViewProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask?: (prefillDate?: string) => void;
}

type ViewMode = 'month' | 'week' | 'agenda';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINI_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDueDateKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return toDateKey(d);
}

function formatReadableDate(dateKey: string): string {
  try {
    const parts = dateKey.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateKey;
}

export default function CalendarView({ onTaskClick, onCreateTask }: CalendarViewProps) {
  const { tasks } = useTasks();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(new Date()));
  const [miniDate, setMiniDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [popoverDateKey, setPopoverDateKey] = useState<string | null>(null);

  // Available projects from tasks and API
  const [apiProjects, setApiProjects] = useState<{ id: string; name: string; color: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/projects')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        const list = Array.isArray(json) ? json : (json?.data ?? []);
        setApiProjects(
          list.map((p: { id: string; name: string; color?: string }) => ({
            id: p.id,
            name: p.name,
            color: p.color || '#2563EB',
          }))
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const allProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const p of apiProjects) {
      map.set(p.id, p);
    }
    for (const t of tasks) {
      if (t.project && !map.has(t.project.id)) {
        map.set(t.project.id, {
          id: t.project.id,
          name: t.project.name,
          color: t.project.color || '#2563EB',
        });
      }
    }
    return Array.from(map.values());
  }, [apiProjects, tasks]);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Sync mini-calendar when main calendar navigates to a new month
  useEffect(() => {
    setMiniDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate]);

  // Filter tasks based on search, status, priority, and project
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const key = parseDueDateKey(task.dueDate);
      if (!key) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (projectFilter !== 'all') {
        const pId = task.projectId || task.project?.id;
        if (pId !== projectFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchNumber = task.taskNumber && task.taskNumber.toLowerCase().includes(q);
        const matchProject = task.project?.name && task.project.name.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber && !matchProject) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter, projectFilter]);

  // O(1) task index by date string "YYYY-MM-DD"
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DBTask[]>();
    for (const task of filteredTasks) {
      const key = parseDueDateKey(task.dueDate);
      if (!key) continue;
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    }
    return map;
  }, [filteredTasks]);

  // Task count per date for mini-calendar dot indicators (based on all tasks with due dates)
  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      const key = parseDueDateKey(task.dueDate);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [tasks]);

  // Status counts for quick filters
  const statusCounts = useMemo(() => {
    const counts = { all: 0, todo: 0, in_progress: 0, in_review: 0, done: 0 };
    for (const t of tasks) {
      if (!t.dueDate) continue;
      counts.all++;
      if (t.status === 'todo') counts.todo++;
      else if (t.status === 'in_progress') counts.in_progress++;
      else if (t.status === 'in_review') counts.in_review++;
      else if (t.status === 'done') counts.done++;
    }
    return counts;
  }, [tasks]);

  // Priority counts
  const priorityCounts = useMemo(() => {
    const counts = { all: 0, urgent: 0, high: 0, medium: 0, low: 0 };
    for (const t of tasks) {
      if (!t.dueDate) continue;
      counts.all++;
      if (t.priority === 'urgent') counts.urgent++;
      else if (t.priority === 'high') counts.high++;
      else if (t.priority === 'medium') counts.medium++;
      else if (t.priority === 'low') counts.low++;
    }
    return counts;
  }, [tasks]);

  // Check if any filter is active
  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    projectFilter !== 'all';

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setProjectFilter('all');
  }, []);

  // Current year & month for Main Calendar
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Main Month Grid Days (Monday-start)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Monday = 1, Sunday = 7

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: {
      dayNumber: number | null;
      date: Date | null;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateKey: string;
      isWeekend: boolean;
    }[] = [];

    // Leading empty slots for previous month
    for (let i = 1; i < startDayOfWeek; i++) {
      days.push({
        dayNumber: null,
        date: null,
        isCurrentMonth: false,
        isToday: false,
        dateKey: `prev-${i}`,
        isWeekend: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const key = toDateKey(thisDate);
      const dayOfWeek = thisDate.getDay();
      days.push({
        dayNumber: d,
        date: thisDate,
        isCurrentMonth: true,
        isToday: key === todayKey,
        dateKey: key,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    // Trailing empty slots to complete final row
    const remainder = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      days.push({
        dayNumber: null,
        date: null,
        isCurrentMonth: false,
        isToday: false,
        dateKey: `next-${i}`,
        isWeekend: false,
      });
    }

    return days;
  }, [year, month, todayKey]);

  // Mini Calendar Month & Days
  const miniYear = miniDate.getFullYear();
  const miniMonth = miniDate.getMonth();
  const miniMonthName = miniDate.toLocaleString('default', { month: 'short' });

  const miniCalendarDays = useMemo(() => {
    const firstDay = new Date(miniYear, miniMonth, 1);
    let startDay = firstDay.getDay();
    if (startDay === 0) startDay = 7;

    const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();
    const days: {
      dayNumber: number | null;
      date: Date | null;
      dateKey: string;
      isToday: boolean;
      hasTasks: boolean;
    }[] = [];

    // Leading empty spaces
    for (let i = 1; i < startDay; i++) {
      days.push({
        dayNumber: null,
        date: null,
        dateKey: `empty-prev-${i}`,
        isToday: false,
        hasTasks: false,
      });
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(miniYear, miniMonth, d);
      const key = toDateKey(thisDate);
      days.push({
        dayNumber: d,
        date: thisDate,
        dateKey: key,
        isToday: key === todayKey,
        hasTasks: (taskCountByDate.get(key) || 0) > 0,
      });
    }

    // Trailing empty spaces
    const remainder = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      days.push({
        dayNumber: null,
        date: null,
        dateKey: `empty-next-${i}`,
        isToday: false,
        hasTasks: false,
      });
    }

    return days;
  }, [miniYear, miniMonth, todayKey, taskCountByDate]);

  // Week View Days
  const weekDays = useMemo(() => {
    const cur = new Date(currentDate);
    let day = cur.getDay();
    if (day === 0) day = 7;
    cur.setDate(cur.getDate() - (day - 1));

    const days: { date: Date; dateKey: string; isToday: boolean; dayName: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + i);
      const key = toDateKey(d);
      days.push({
        date: d,
        dateKey: key,
        isToday: key === todayKey,
        dayName: d.toLocaleString('default', { weekday: 'short' }),
      });
    }
    return days;
  }, [currentDate, todayKey]);

  // Agenda View Tasks: Grouped Chronologically by Date
  const agendaSections = useMemo(() => {
    // Sort keys chronologically
    const sortedKeys = Array.from(tasksByDate.keys()).sort();
    return sortedKeys.map(key => {
      const dateTasks = tasksByDate.get(key) || [];
      const isDateToday = key === todayKey;
      return {
        dateKey: key,
        isToday: isDateToday,
        readableDate: formatReadableDate(key),
        tasks: dateTasks,
      };
    });
  }, [tasksByDate, todayKey]);

  // Selected date tasks (especially vital for mobile month view)
  const selectedDateTasks = useMemo(() => {
    return tasksByDate.get(selectedDateKey) || [];
  }, [tasksByDate, selectedDateKey]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      // Agenda: jump backward by 1 month
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      // Agenda: jump forward by 1 month
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateKey(toDateKey(now));
    setMiniDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleSelectDate = (date: Date, key: string) => {
    setSelectedDateKey(key);
    setCurrentDate(date);
  };

  // Header Title
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${monthName} ${year}`;
    }
    if (viewMode === 'week' && weekDays.length === 7) {
      const start = weekDays[0].date;
      const end = weekDays[6].date;
      const sm = start.toLocaleString('default', { month: 'short' });
      const em = end.toLocaleString('default', { month: 'short' });
      if (sm === em) {
        return `${sm} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${monthName} ${year}`;
  }, [viewMode, monthName, year, weekDays]);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-white select-none relative font-sans">
      {/* ========================================================= */}
      {/* LEFT: Mini Calendar & Refined Filters                     */}
      {/* Mobile: slide-over drawer; Desktop: fixed sidebar         */}
      {/* ========================================================= */}

      {/* Mobile backdrop when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {sidebarOpen && (
        <aside
          className={[
            // Desktop: inline sidebar
            'md:relative md:translate-x-0 md:z-auto md:w-64 lg:w-72 md:shrink-0',
            'md:border-r md:border-[#E5E7EB] md:bg-[#F9FAFB] md:flex md:flex-col md:h-full md:overflow-y-auto',
            // Mobile: fixed slide-over overlay drawer
            'fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-white flex flex-col h-full overflow-y-auto',
            'border-r border-[#E5E7EB] shadow-2xl md:shadow-none',
            'transition-transform duration-200 ease-out',
          ].join(' ')}
        >
          {/* Mobile drawer header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
              <span className="text-[14px] font-bold text-[#111111]">Calendar & Filters</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
              aria-label="Close panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Primary Action Button */}
          <div className="p-3.5 border-b border-[#E5E7EB]/80">
            <button
              onClick={() => {
                onCreateTask?.(selectedDateKey);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-[13px] font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Task</span>
            </button>
          </div>

          <div className="p-3.5 space-y-4">
            {/* MINI CALENDAR */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[13px] font-bold text-[#111111]">
                  {miniMonthName} {miniYear}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() =>
                      setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111] transition-colors"
                    title="Previous month"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111] transition-colors"
                    title="Next month"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day initial headers */}
              <div className="grid grid-cols-7 text-center mb-1">
                {MINI_DAYS.map((d, i) => (
                  <div key={i} className="text-[10px] font-semibold text-[#9CA3AF] py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {miniCalendarDays.map((cell, idx) => {
                  if (!cell.dayNumber || !cell.date) {
                    return <div key={idx} className="h-6 w-6" />;
                  }

                  const isSelected = cell.dateKey === selectedDateKey;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDate(cell.date!, cell.dateKey)}
                      className={`h-6 w-6 mx-auto flex flex-col items-center justify-center rounded-full text-[11px] font-medium relative transition-colors ${
                        isSelected
                          ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                          : cell.isToday
                          ? 'text-[#2563EB] font-bold ring-1.5 ring-[#2563EB]/50 hover:bg-[#EFF6FF]'
                          : 'text-[#374151] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      <span className="leading-none">{cell.dayNumber}</span>
                      {cell.hasTasks && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#2563EB]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Filters Shortcut (if active) */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-medium text-[#6B7280]">Filters active</span>
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                >
                  Reset all
                </button>
              </div>
            )}

            {/* Quick Status Filter */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider px-1">
                Status
              </div>
              <div className="space-y-0.5">
                {[
                  { id: 'all', label: 'All Tasks', count: statusCounts.all, dot: '#6B7280' },
                  { id: 'todo', label: 'To Do', count: statusCounts.todo, dot: '#2563EB' },
                  { id: 'in_progress', label: 'In Progress', count: statusCounts.in_progress, dot: '#EA580C' },
                  { id: 'in_review', label: 'In Review', count: statusCounts.in_review, dot: '#7C3AED' },
                  { id: 'done', label: 'Done', count: statusCounts.done, dot: '#16A34A' },
                ].map(item => {
                  const active = statusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setStatusFilter(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                          : 'text-[#4B5563] hover:bg-white hover:text-[#111111]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.dot }}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-[#9CA3AF] font-mono shrink-0 ml-1">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority Filter */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider px-1">
                Priority
              </div>
              <div className="space-y-0.5">
                {[
                  { id: 'all', label: 'All Priorities', count: priorityCounts.all, dot: '#6B7280' },
                  { id: 'urgent', label: 'Urgent', count: priorityCounts.urgent, dot: '#DC2626' },
                  { id: 'high', label: 'High', count: priorityCounts.high, dot: '#EA580C' },
                  { id: 'medium', label: 'Medium', count: priorityCounts.medium, dot: '#F59E0B' },
                  { id: 'low', label: 'Low', count: priorityCounts.low, dot: '#6B7280' },
                ].map(item => {
                  const active = priorityFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setPriorityFilter(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                          : 'text-[#4B5563] hover:bg-white hover:text-[#111111]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.dot }}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-[#9CA3AF] font-mono shrink-0 ml-1">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Projects Filter */}
            {allProjects.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider px-1">
                  Projects
                </div>
                <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                  <button
                    onClick={() => setProjectFilter('all')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                      projectFilter === 'all'
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                        : 'text-[#4B5563] hover:bg-white hover:text-[#111111]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280] shrink-0" />
                      <span className="truncate">All Projects</span>
                    </div>
                  </button>
                  {allProjects.map(proj => {
                    const active = projectFilter === proj.id;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => setProjectFilter(proj.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                          active
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                            : 'text-[#4B5563] hover:bg-white hover:text-[#111111]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="truncate text-left">{proj.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ========================================================= */}
      {/* RIGHT / MAIN CALENDAR CONTAINER                           */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-white">
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#E5E7EB] bg-white shrink-0 gap-2">
          {/* Left Controls: Sidebar toggle, Prev/Next, Month Title, Today */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                className={`p-1.5 rounded-lg border transition-colors relative shrink-0 ${
                  sidebarOpen
                    ? 'border-[#E5E7EB] bg-[#F9FAFB] text-[#111111]'
                    : 'border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280]'
                }`}
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar & filters'}
                aria-label="Toggle sidebar"
              >
                {/* On mobile show funnel filter icon; on desktop show sidebar panel icon */}
                <svg className="hidden sm:block" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
                <svg className="sm:hidden" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#2563EB]" />
                )}
              </button>

              {/* Prev / Next */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePrev}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] transition-colors"
                  aria-label="Previous period"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  onClick={handleNext}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] transition-colors"
                  aria-label="Next period"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Today Button */}
              <button
                onClick={handleToday}
                className="text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-2 py-1 rounded-md transition-colors"
              >
                Today
              </button>
            </div>

            {/* Period Title */}
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-[15px] sm:text-[17px] font-bold text-[#111111] tracking-tight truncate">
                {headerTitle}
              </h2>
              {filteredTasks.length > 0 && (
                <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3F4F6] text-[#4B5563]">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Search, View Switcher, Create Task */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
            {/* Search Input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:border-[#CBD5E1] bg-[#F9FAFB] focus-within:bg-white focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all text-[12px] flex-1 sm:flex-initial shadow-2xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="shrink-0">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="bg-transparent text-[#111111] placeholder-[#9CA3AF] outline-none border-none focus:outline-none focus:ring-0 w-full sm:w-32 md:w-44"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#E5E7EB] transition-colors shrink-0"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* View Mode Switcher: Month, Week, Agenda */}
            <div className="flex items-center p-0.5 bg-[#F3F4F6] rounded-lg shrink-0">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-medium transition-all ${
                  viewMode === 'agenda'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Agenda
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================= */}
        {/* VIEW 1: MONTH VIEW                                      */}
        {/* Responsive: Full grid on desktop; Hybrid grid + day     */}
        {/* agenda sheet on mobile to guarantee readability.        */}
        {/* ======================================================= */}
        {viewMode === 'month' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
            {/* Days header: Mon Tue Wed Thu Fri Sat Sun */}
            <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#FAFAFA] shrink-0 text-center py-2">
              {DAYS_OF_WEEK.map((day, i) => (
                <div
                  key={day}
                  className={`text-[11px] font-bold tracking-wider uppercase ${
                    i >= 5 ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                  }`}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet Grid Cells */}
            <div className="hidden sm:grid flex-1 grid-cols-7 divide-x divide-y divide-[#E5E7EB] overflow-y-auto">
              {calendarDays.map((cell, idx) => {
                if (!cell.isCurrentMonth || !cell.dayNumber || !cell.date) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[105px] bg-[#FAFAFA]/60"
                    />
                  );
                }

                const dayTasks = tasksByDate.get(cell.dateKey) || [];
                const isSelected = cell.dateKey === selectedDateKey;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`min-h-[105px] p-1.5 flex flex-col transition-colors group relative cursor-pointer ${
                      isSelected
                        ? 'bg-[#F4F8FF]'
                        : cell.isWeekend
                        ? 'bg-[#FCFCFC] hover:bg-[#F9FAFC]'
                        : 'bg-white hover:bg-[#FAFAFC]'
                    }`}
                  >
                    {/* Day Number + Quick Add */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[12px] font-semibold flex items-center justify-center rounded-full w-6 h-6 transition-colors ${
                          cell.isToday
                            ? 'bg-[#2563EB] text-white shadow-2xs font-bold'
                            : isSelected
                            ? 'bg-[#DBEAFE] text-[#1E40AF] font-bold'
                            : 'text-[#1F2937]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Quick Add Task button on cell hover */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onCreateTask?.(cell.dateKey);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all"
                        title={`Add task for ${cell.dateKey}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>

                    {/* Task Chips */}
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {dayTasks.slice(0, 3).map(task => {
                        const priorityCfg = priorityColors[task.priority as Priority] || { color: '#6B7280' };
                        const isDone = task.status === 'done';

                        return (
                          <div
                            key={task.id}
                            onClick={e => {
                              e.stopPropagation();
                              onTaskClick(task.id);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-0.5 sm:py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-all truncate group/pill ${
                              isDone
                                ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF] line-through'
                                : 'bg-white hover:bg-[#F8FAFC] border-[#E5E7EB] hover:border-[#93C5FD] text-[#111111] shadow-2xs'
                            }`}
                            title={`${task.taskNumber ? task.taskNumber + ': ' : ''}${task.title}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: priorityCfg.color }}
                            />
                            <span className="truncate">
                              {task.taskNumber && (
                                <span className="font-mono text-[9.5px] text-[#6B7280] mr-1">
                                  {task.taskNumber}
                                </span>
                              )}
                              {task.title}
                            </span>
                          </div>
                        );
                      })}

                      {dayTasks.length > 3 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setPopoverDateKey(cell.dateKey);
                          }}
                          className="w-full text-left text-[10px] font-semibold text-[#2563EB] hover:underline px-1 py-0.5"
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Month View: Compact Touch Calendar + Selected Day Agenda Sheet */}
            <div className="sm:hidden flex-1 flex flex-col min-h-0 overflow-y-auto">
              {/* Compact Month Grid with Dot Indicators */}
              <div className="grid grid-cols-7 border-b border-[#E5E7EB] divide-x divide-y divide-[#F3F4F6] shrink-0 bg-white">
                {calendarDays.map((cell, idx) => {
                  if (!cell.isCurrentMonth || !cell.dayNumber || !cell.date) {
                    return <div key={idx} className="h-11 bg-[#FAFAFA]/50" />;
                  }

                  const dayTasks = tasksByDate.get(cell.dateKey) || [];
                  const isSelected = cell.dateKey === selectedDateKey;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDateKey(cell.dateKey)}
                      className={`h-12 flex flex-col items-center justify-center p-0.5 relative transition-colors ${
                        isSelected
                          ? 'bg-[#EFF6FF]'
                          : 'hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <span
                        className={`text-[12px] font-semibold flex items-center justify-center rounded-full w-6 h-6 leading-none ${
                          cell.isToday
                            ? 'bg-[#2563EB] text-white font-bold shadow-2xs'
                            : isSelected
                            ? 'bg-[#DBEAFE] text-[#1D4ED8] font-bold'
                            : 'text-[#1F2937]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Dots row */}
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 h-1.5">
                        {dayTasks.slice(0, 3).map(t => {
                          const priorityCfg = priorityColors[t.priority as Priority] || { color: '#2563EB' };
                          return (
                            <span
                              key={t.id}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: priorityCfg.color }}
                            />
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <span className="w-1 h-1 rounded-full bg-[#9CA3AF]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Selected Day Agenda Section */}
              <div className="flex-1 p-3 bg-[#F9FAFB]">
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#111111]">
                      {formatReadableDate(selectedDateKey)}
                    </span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E5E7EB] text-[#4B5563]">
                      {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                  <button
                    onClick={() => onCreateTask?.(selectedDateKey)}
                    className="flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] py-1 px-2 rounded-md hover:bg-[#EFF6FF] transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add Task</span>
                  </button>
                </div>

                {/* Day Task List */}
                <div className="pt-2.5 space-y-2">
                  {selectedDateTasks.map(task => {
                    const statusCfg = statusColors[task.status as Status] || {
                      bg: '#F3F4F6',
                      text: '#6B7280',
                      label: task.status,
                    };
                    const priorityCfg = priorityColors[task.priority as Priority] || {
                      color: '#6B7280',
                      label: task.priority,
                    };
                    const isDone = task.status === 'done';

                    return (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className="p-3 rounded-xl border border-[#E5E7EB] bg-white shadow-2xs hover:border-[#93C5FD] active:scale-[0.99] transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {task.taskNumber && (
                              <span className="font-mono text-[11px] font-semibold text-[#6B7280]">
                                {task.taskNumber}
                              </span>
                            )}
                            {task.project && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#4B5563] bg-[#F3F4F6] px-1.5 py-0.5 rounded truncate">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: task.project.color || '#2563EB' }}
                                />
                                {task.project.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                            >
                              {statusCfg.label}
                            </span>
                          </div>
                        </div>

                        <h4
                          className={`text-[13px] font-semibold text-[#111111] ${
                            isDone ? 'line-through text-[#9CA3AF]' : ''
                          }`}
                        >
                          {task.title}
                        </h4>

                        <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-[11px] text-[#6B7280]">
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: priorityCfg.color }}
                            />
                            {priorityCfg.label}
                          </span>

                          {task.assignee && (
                            <span className="text-[11px] font-medium text-[#374151]">
                              {task.assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {selectedDateTasks.length === 0 && (
                    <div
                      onClick={() => onCreateTask?.(selectedDateKey)}
                      className="py-8 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-[#D1D5DB] bg-white cursor-pointer hover:border-[#2563EB] hover:bg-[#F9FBFF] transition-all"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="mb-2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <p className="text-[12px] font-semibold text-[#374151]">No tasks on this date</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">Tap here to create a new task</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* VIEW 2: WEEK VIEW                                       */}
        {/* Multi-column layout with rich task cards                */}
        {/* ======================================================= */}
        {viewMode === 'week' && (
          <div className="flex-1 overflow-x-auto bg-white">
            <div className="min-w-[760px] h-full grid grid-cols-7 divide-x divide-[#E5E7EB] overflow-y-auto">
              {weekDays.map((cell, idx) => {
                const dayTasks = tasksByDate.get(cell.dateKey) || [];

                return (
                  <div
                    key={idx}
                    className={`flex flex-col p-2.5 transition-colors ${
                      cell.isToday ? 'bg-[#F8FAFF]' : 'bg-white'
                    }`}
                  >
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] mb-2.5">
                      <div>
                        <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                          {cell.dayName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[13px] font-bold flex items-center justify-center rounded-full w-6 h-6 ${
                              cell.isToday
                                ? 'bg-[#2563EB] text-white shadow-2xs'
                                : 'text-[#111111]'
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onCreateTask?.(cell.dateKey)}
                        className="w-6 h-6 rounded flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                        title="Add task"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>

                    {/* Column Tasks */}
                    <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                      {dayTasks.map(task => {
                        const statusCfg = statusColors[task.status as Status] || {
                          bg: '#F3F4F6',
                          text: '#6B7280',
                          label: task.status,
                        };
                        const priorityCfg = priorityColors[task.priority as Priority] || {
                          color: '#6B7280',
                          label: task.priority,
                        };
                        const isDone = task.status === 'done';

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task.id)}
                            className="p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#93C5FD] hover:shadow-xs bg-white cursor-pointer transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              {task.taskNumber ? (
                                <span className="font-mono text-[10px] text-[#6B7280] font-semibold">
                                  {task.taskNumber}
                                </span>
                              ) : (
                                <span />
                              )}
                              <span
                                className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                                style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                              >
                                {statusCfg.label}
                              </span>
                            </div>

                            <h4
                              className={`text-[12px] font-semibold text-[#111111] line-clamp-2 leading-snug ${
                                isDone ? 'line-through text-[#9CA3AF]' : ''
                              }`}
                            >
                              {task.title}
                            </h4>

                            <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-[10px]">
                              <span className="flex items-center gap-1 text-[#6B7280]">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: priorityCfg.color }}
                                />
                                {priorityCfg.label}
                              </span>

                              {task.project && (
                                <span className="truncate max-w-[80px] font-medium text-[#4B5563]">
                                  {task.project.name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {dayTasks.length === 0 && (
                        <div
                          onClick={() => onCreateTask?.(cell.dateKey)}
                          className="h-20 flex flex-col items-center justify-center text-[11px] text-[#9CA3AF] border border-dashed border-[#E5E7EB] rounded-lg hover:border-[#93C5FD] hover:bg-[#FAFAFC] cursor-pointer transition-colors"
                        >
                          <span>+ Add task</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* VIEW 3: AGENDA VIEW                                     */}
        {/* Clean chronological schedule feed                       */}
        {/* ======================================================= */}
        {viewMode === 'agenda' && (
          <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-3 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {agendaSections.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-[#111111]">No scheduled tasks found</h3>
                  <p className="text-[13px] text-[#6B7280] mt-1 max-w-sm mx-auto">
                    {hasActiveFilters
                      ? 'No tasks match your selected filters. Try resetting your search or filters.'
                      : 'You do not have any tasks scheduled for this period.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="px-3.5 py-1.5 border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] text-[12px] font-semibold rounded-lg transition-colors"
                      >
                        Reset filters
                      </button>
                    )}
                    <button
                      onClick={() => onCreateTask?.(selectedDateKey)}
                      className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold rounded-lg shadow-2xs transition-colors"
                    >
                      + Create task
                    </button>
                  </div>
                </div>
              ) : (
                agendaSections.map(section => (
                  <div key={section.dateKey} className="space-y-2">
                    {/* Date Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-bold ${
                            section.isToday ? 'text-[#2563EB]' : 'text-[#111111]'
                          }`}
                        >
                          {section.readableDate}
                        </span>
                        {section.isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                            TODAY
                          </span>
                        )}
                        <span className="text-[11px] text-[#9CA3AF] font-mono">
                          ({section.tasks.length})
                        </span>
                      </div>

                      <button
                        onClick={() => onCreateTask?.(section.dateKey)}
                        className="text-[11px] font-semibold text-[#6B7280] hover:text-[#2563EB] hover:underline"
                      >
                        + Add task
                      </button>
                    </div>

                    {/* Task cards */}
                    <div className="space-y-2">
                      {section.tasks.map(task => {
                        const statusCfg = statusColors[task.status as Status] || {
                          bg: '#F3F4F6',
                          text: '#6B7280',
                          label: task.status,
                        };
                        const priorityCfg = priorityColors[task.priority as Priority] || {
                          color: '#6B7280',
                          label: task.priority,
                        };
                        const isDone = task.status === 'done';

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task.id)}
                            className="p-3.5 rounded-xl border border-[#E5E7EB] hover:border-[#93C5FD] bg-white shadow-2xs hover:shadow-xs cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                                style={{ backgroundColor: priorityCfg.color }}
                                title={`Priority: ${priorityCfg.label}`}
                              />

                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {task.taskNumber && (
                                    <span className="font-mono text-[11px] font-semibold text-[#6B7280]">
                                      {task.taskNumber}
                                    </span>
                                  )}
                                  <h4
                                    className={`text-[13px] font-semibold text-[#111111] truncate ${
                                      isDone ? 'line-through text-[#9CA3AF]' : ''
                                    }`}
                                  >
                                    {task.title}
                                  </h4>
                                </div>

                                {task.description && (
                                  <p className="text-[12px] text-[#6B7280] line-clamp-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {task.project && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F3F4F6] text-[#374151]">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: task.project.color || '#2563EB' }}
                                  />
                                  <span className="truncate max-w-[100px]">{task.project.name}</span>
                                </span>
                              )}

                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                              >
                                {statusCfg.label}
                              </span>

                              {task.assignee && (
                                <div
                                  className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[10px] font-bold flex items-center justify-center shrink-0"
                                  title={`Assigned to ${task.assignee.name}`}
                                >
                                  {task.assignee.avatar || task.assignee.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MOBILE FLOATING ACTION BUTTON (+ New Task)                */}
      {/* ========================================================= */}
      <button
        onClick={() => onCreateTask?.(selectedDateKey)}
        className="sm:hidden fixed bottom-5 right-5 z-20 w-13 h-13 rounded-full bg-[#2563EB] text-white shadow-xl hover:bg-[#1D4ED8] active:scale-95 flex items-center justify-center transition-all"
        aria-label="Create new task"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ========================================================= */}
      {/* DAY TASKS POPOVER MODAL (When clicking "+N more")         */}
      {/* ========================================================= */}
      {popoverDateKey && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setPopoverDateKey(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#111111]">
                  Tasks on {formatReadableDate(popoverDateKey)}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E5E7EB] text-[#4B5563]">
                  {(tasksByDate.get(popoverDateKey) || []).length}
                </span>
              </div>
              <button
                onClick={() => setPopoverDateKey(null)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-3 max-h-[340px] overflow-y-auto space-y-2">
              {(tasksByDate.get(popoverDateKey) || []).map(task => {
                const statusCfg = statusColors[task.status as Status] || {
                  bg: '#F3F4F6',
                  text: '#6B7280',
                  label: task.status,
                };
                const priorityCfg = priorityColors[task.priority as Priority] || {
                  color: '#6B7280',
                  label: task.priority,
                };
                const isDone = task.status === 'done';

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setPopoverDateKey(null);
                      onTaskClick(task.id);
                    }}
                    className="p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#93C5FD] hover:bg-[#F9FAFB] cursor-pointer transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: priorityCfg.color }}
                        />
                        {task.taskNumber && (
                          <span className="font-mono text-[10px] text-[#6B7280] font-semibold">
                            {task.taskNumber}
                          </span>
                        )}
                        <h4
                          className={`text-[12px] font-semibold text-[#111111] truncate ${
                            isDone ? 'line-through text-[#9CA3AF]' : ''
                          }`}
                        >
                          {task.title}
                        </h4>
                      </div>

                      <span
                        className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                        style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#FAFAFA] border-t border-[#E5E7EB] flex items-center justify-between">
              <span className="text-[11px] text-[#6B7280]">Click any task to view details</span>
              <button
                onClick={() => {
                  const key = popoverDateKey;
                  setPopoverDateKey(null);
                  onCreateTask?.(key);
                }}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
