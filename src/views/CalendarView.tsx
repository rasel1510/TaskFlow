'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { statusColors, priorityColors, type Status, type Priority } from '@/data/mockData';

interface CalendarViewProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask?: (prefillDate?: string) => void;
}

type ViewMode = 'month' | 'week';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MINI_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarView({ onTaskClick, onCreateTask }: CalendarViewProps) {
  const { tasks } = useTasks();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(new Date()));
  const [miniDate, setMiniDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [popoverDateKey, setPopoverDateKey] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Sync mini-calendar when main calendar navigates to a new month
  useEffect(() => {
    setMiniDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate]);

  // Filter tasks based on search and status
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchNumber = task.taskNumber && task.taskNumber.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter]);

  // O(1) task index by date string "YYYY-MM-DD"
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DBTask[]>();
    for (const task of filteredTasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      if (isNaN(d.getTime())) continue;
      const key = toDateKey(d);
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    }
    return map;
  }, [filteredTasks]);

  // Task count per date for mini-calendar dot indicators
  const taskCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      if (isNaN(d.getTime())) continue;
      const key = toDateKey(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [tasks]);

  // Status counts for quick filters
  const statusCounts = useMemo(() => {
    const counts = { all: 0, todo: 0, in_progress: 0, done: 0 };
    for (const t of tasks) {
      if (!t.dueDate) continue;
      counts.all++;
      if (t.status === 'todo') counts.todo++;
      else if (t.status === 'in_progress') counts.in_progress++;
      else if (t.status === 'done') counts.done++;
    }
    return counts;
  }, [tasks]);

  // Current year & month for Main Calendar
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Main Month Grid Days (Noise-free: leading/trailing dates have NO numbers)
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
    }[] = [];

    // Leading empty slots for previous month
    for (let i = 1; i < startDayOfWeek; i++) {
      days.push({
        dayNumber: null,
        date: null,
        isCurrentMonth: false,
        isToday: false,
        dateKey: `prev-${i}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const key = toDateKey(thisDate);
      days.push({
        dayNumber: d,
        date: thisDate,
        isCurrentMonth: true,
        isToday: key === todayKey,
        dateKey: key,
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
      });
    }

    return days;
  }, [year, month, todayKey]);

  // Mini Calendar Month & Days (Clean, compact, no external dates)
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

    const days: { date: Date; dateKey: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + i);
      const key = toDateKey(d);
      days.push({ date: d, dateKey: key, isToday: key === todayKey });
    }
    return days;
  }, [currentDate, todayKey]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
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
    if (weekDays.length === 7) {
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
    <div className="flex-1 flex h-full overflow-hidden bg-white select-none">
      {/* ========================================================= */}
      {/* LEFT: Mini Calendar & Clean Filters                       */}
      {/* ========================================================= */}
      {sidebarOpen && (
        <aside className="w-64 lg:w-68 shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFA] flex flex-col h-full overflow-y-auto">
          {/* Action button */}
          <div className="p-3.5 border-b border-[#E5E7EB]/60">
            <button
              onClick={() => onCreateTask?.(selectedDateKey)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Task</span>
            </button>
          </div>

          <div className="p-3.5 space-y-4">
            {/* SMALL CALENDAR (Mini Calendar) */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 shadow-2xs">
              {/* Mini Calendar Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[13px] font-semibold text-[#111111]">
                  {miniMonthName} {miniYear}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111] transition-colors"
                    title="Previous month"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMiniDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111] transition-colors"
                    title="Next month"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day initials header */}
              <div className="grid grid-cols-7 text-center mb-1">
                {MINI_DAYS.map((d, i) => (
                  <div key={i} className="text-[10px] font-semibold text-[#9CA3AF] py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells: ONLY numbers for current month */}
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
                          ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                          : cell.isToday
                          ? 'text-[#2563EB] font-bold ring-1.5 ring-[#2563EB]/40 hover:bg-[#EFF6FF]'
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

            {/* Quick Status Filter Pills */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider px-1">
                Filter
              </div>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'All Tasks', count: statusCounts.all },
                  { id: 'todo', label: 'To Do', count: statusCounts.todo },
                  { id: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
                  { id: 'done', label: 'Done', count: statusCounts.done },
                ].map(item => {
                  const active = statusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setStatusFilter(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] text-[#1E40AF] font-semibold'
                          : 'text-[#4B5563] hover:bg-white hover:text-[#111111]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[11px] text-[#9CA3AF] font-mono">{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================= */}
      {/* RIGHT: Main Clean Calendar Grid                           */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Clean Header Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB] bg-white shrink-0">
          {/* Navigation & Month */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] transition-colors"
              title={sidebarOpen ? 'Hide small calendar' : 'Show small calendar'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            <h2 className="text-[17px] font-bold text-[#111111] tracking-tight ml-1">
              {headerTitle}
            </h2>

            <button
              onClick={handleToday}
              className="text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-2 py-0.5 rounded-md transition-colors ml-1"
            >
              Today
            </button>
          </div>

          {/* Right Tools: Search & Month/Week Switch */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[12px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="bg-transparent text-[#111111] placeholder-[#9CA3AF] outline-none w-28 sm:w-36"
              />
            </div>

            <div className="flex items-center p-0.5 bg-[#F3F4F6] rounded-lg">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================= */}
        {/* MONTH VIEW                                              */}
        {/* ======================================================= */}
        {viewMode === 'month' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
            {/* Days header: Mon Tue Wed Thu Fri Sat Sun */}
            <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#FAFAFA] shrink-0 text-center py-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Cells: Crisp, noise-free, empty slots for other months */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-y divide-[#E5E7EB] overflow-y-auto">
              {calendarDays.map((cell, idx) => {
                // If cell is outside active month: render quiet, clean empty space (no confusing numbers)
                if (!cell.isCurrentMonth || !cell.dayNumber || !cell.date) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[100px] bg-[#FAFAFA]/50"
                    />
                  );
                }

                const dayTasks = tasksByDate.get(cell.dateKey) || [];
                const isSelected = cell.dateKey === selectedDateKey;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`min-h-[100px] p-2 flex flex-col transition-colors group relative cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5F8FF]'
                        : 'bg-white hover:bg-[#FAFAFC]'
                    }`}
                  >
                    {/* Day Number + Quick Add */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[12px] font-semibold flex items-center justify-center rounded-full w-6 h-6 transition-colors ${
                          cell.isToday
                            ? 'bg-[#2563EB] text-white shadow-2xs'
                            : isSelected
                            ? 'bg-[#DBEAFE] text-[#1E40AF]'
                            : 'text-[#111111]'
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
                        title="Add task"
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
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-all truncate ${
                              isDone
                                ? 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF] line-through'
                                : 'bg-white hover:bg-[#F8FAFC] border-[#E5E7EB] hover:border-[#93C5FD] text-[#111111]'
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
          </div>
        )}

        {/* ======================================================= */}
        {/* WEEK VIEW                                               */}
        {/* ======================================================= */}
        {viewMode === 'week' && (
          <div className="flex-1 overflow-x-auto bg-white">
            <div className="min-w-[700px] h-full grid grid-cols-7 divide-x divide-[#E5E7EB] overflow-y-auto">
              {weekDays.map((cell, idx) => {
                const dayTasks = tasksByDate.get(cell.dateKey) || [];

                return (
                  <div
                    key={idx}
                    className={`flex flex-col p-3 transition-colors ${
                      cell.isToday ? 'bg-[#F8FAFF]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#F0F1F3] mb-3">
                      <div>
                        <div className="text-[11px] font-bold text-[#6B7280] uppercase">
                          {cell.date.toLocaleString('default', { weekday: 'short' })}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[14px] font-bold flex items-center justify-center rounded-full w-7 h-7 ${
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

                    <div className="flex-1 space-y-2 overflow-y-auto">
                      {dayTasks.map(task => {
                        const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: task.status };

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task.id)}
                            className="p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#93C5FD] bg-white cursor-pointer transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              {task.taskNumber && (
                                <span className="font-mono text-[10px] text-[#6B7280]">
                                  {task.taskNumber}
                                </span>
                              )}
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                              >
                                {statusCfg.label}
                              </span>
                            </div>
                            <h4 className="text-[12px] font-semibold text-[#111111] line-clamp-2">
                              {task.title}
                            </h4>
                          </div>
                        );
                      })}

                      {dayTasks.length === 0 && (
                        <div
                          onClick={() => onCreateTask?.(cell.dateKey)}
                          className="h-20 flex items-center justify-center text-[11px] text-[#9CA3AF] border border-dashed border-[#E5E7EB] rounded-lg hover:bg-[#FAFAFC] cursor-pointer"
                        >
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DAY TASKS MODAL (When clicking "+N more")                 */}
      {/* ========================================================= */}
      {popoverDateKey && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setPopoverDateKey(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
              <h3 className="text-[14px] font-bold text-[#111111]">
                Tasks on {popoverDateKey}
              </h3>
              <button
                onClick={() => setPopoverDateKey(null)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#6B7280] hover:text-[#111111]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-3 max-h-[300px] overflow-y-auto space-y-1.5">
              {(tasksByDate.get(popoverDateKey) || []).map(task => (
                <div
                  key={task.id}
                  onClick={() => {
                    setPopoverDateKey(null);
                    onTaskClick(task.id);
                  }}
                  className="p-2.5 rounded-lg border border-[#E5E7EB] hover:border-[#93C5FD] hover:bg-[#F9FAFB] cursor-pointer transition-all flex items-center justify-between gap-2"
                >
                  <span className="text-[12px] font-medium text-[#111111] truncate">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-mono shrink-0">
                    {task.taskNumber}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-[#FAFAFA] border-t border-[#E5E7EB] flex justify-end">
              <button
                onClick={() => {
                  const key = popoverDateKey;
                  setPopoverDateKey(null);
                  onCreateTask?.(key);
                }}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold rounded-lg transition-colors"
              >
                + Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
