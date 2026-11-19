'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { statusColors, priorityColors, type Status, type Priority } from '@/data/mockData';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  Folder,
  User as UserIcon,
  Layers,
  Sparkles,
  X,
  SlidersHorizontal,
} from 'lucide-react';

// =========================================================================
// Props & Types
// =========================================================================

interface TimelineViewProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask?: (prefillDate?: string) => void;
}

type ViewScale = 'days' | 'weeks' | 'months';
type GroupBy = 'project' | 'status' | 'assignee' | 'none';

interface TimelineTaskItem {
  task: DBTask;
  startDate: Date;
  dueDate: Date;
  startKey: string;
  dueKey: string;
  durationDays: number;
  progress: number;
}

// =========================================================================
// Date Helpers (O(1) pure functions)
// =========================================================================

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

function parseTaskDates(task: DBTask): { startDate: Date; dueDate: Date } | null {
  if (!task.dueDate) return null;

  const due = new Date(task.dueDate);
  if (isNaN(due.getTime())) return null;

  // Derive start date:
  // 1. If createdAt is present and before dueDate, use it (clamped to max 14 days before due for UI proportion)
  // 2. Otherwise default to 3 days before dueDate (or estimate if specified)
  let start: Date;
  if (task.createdAt) {
    const created = new Date(task.createdAt);
    if (!isNaN(created.getTime()) && created.getTime() < due.getTime()) {
      const diffDays = (due.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 21) {
        start = addDays(due, -14);
      } else {
        start = created;
      }
    } else {
      start = addDays(due, -3);
    }
  } else {
    start = addDays(due, -3);
  }

  // Ensure start is at least 1 day before or same day
  if (start.getTime() > due.getTime()) {
    start = addDays(due, -1);
  }

  return {
    startDate: startOfDay(start),
    dueDate: startOfDay(due),
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// =========================================================================
// Main TimelineView Component
// =========================================================================

export default function TimelineView({ onTaskClick, onCreateTask }: TimelineViewProps) {
  const { tasks, isLoading } = useTasks();

  // Navigation & View state
  const [baseDate, setBaseDate] = useState<Date>(() => startOfDay(new Date()));
  const [viewScale, setViewScale] = useState<ViewScale>('days');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [showUnscheduledDrawer, setShowUnscheduledDrawer] = useState(false);

  // Hover state for interactive tooltip
  const [hoveredTask, setHoveredTask] = useState<DBTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Today reference
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Window geometry based on viewScale
  const { colWidth, daysCount, offsetStartDays } = useMemo(() => {
    switch (viewScale) {
      case 'days':
        return { colWidth: 46, daysCount: 35, offsetStartDays: -7 };
      case 'weeks':
        return { colWidth: 28, daysCount: 70, offsetStartDays: -14 };
      case 'months':
        return { colWidth: 16, daysCount: 150, offsetStartDays: -30 };
    }
  }, [viewScale]);

  // Timeline start and end dates
  const windowStartDate = useMemo(() => {
    return addDays(baseDate, offsetStartDays);
  }, [baseDate, offsetStartDays]);

  // Pre-generate day columns for the visible window
  const dayColumns = useMemo(() => {
    const cols: { date: Date; key: string; dayNum: number; dayName: string; isWeekend: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = addDays(windowStartDate, i);
      const key = toDateKey(d);
      const dayOfWeek = d.getDay();
      cols.push({
        date: d,
        key,
        dayNum: d.getDate(),
        dayName: SHORT_DAYS[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: key === todayKey,
      });
    }
    return cols;
  }, [windowStartDate, daysCount, todayKey]);

  // Group columns by Month for the top ruler
  const monthHeaders = useMemo(() => {
    const headers: { monthName: string; year: number; startIndex: number; count: number }[] = [];
    let currentMonth = -1;
    let currentYear = -1;

    dayColumns.forEach((col, idx) => {
      const m = col.date.getMonth();
      const y = col.date.getFullYear();
      if (m !== currentMonth || y !== currentYear) {
        currentMonth = m;
        currentYear = y;
        headers.push({
          monthName: MONTH_NAMES[m],
          year: y,
          startIndex: idx,
          count: 1,
        });
      } else {
        headers[headers.length - 1].count += 1;
      }
    });

    return headers;
  }, [dayColumns]);

  // Calculate pixel position of the Today line
  const todayLeftPx = useMemo(() => {
    const diffMs = today.getTime() - windowStartDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays >= daysCount) return null;
    return diffDays * colWidth + colWidth / 2;
  }, [today, windowStartDate, daysCount, colWidth]);

  // Extract all unique projects for filter
  const allProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    tasks.forEach(t => {
      if (t.project) {
        map.set(t.project.id, { id: t.project.id, name: t.project.name, color: t.project.color });
      }
    });
    return Array.from(map.values());
  }, [tasks]);

  // Split tasks into Scheduled vs Unscheduled
  const { scheduledTasks, unscheduledTasks } = useMemo(() => {
    const sched: TimelineTaskItem[] = [];
    const unsched: DBTask[] = [];

    // Filter by search, project, status, priority
    const filtered = tasks.filter(task => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchNumber = task.taskNumber?.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber) return false;
      }
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (projectFilter !== 'all' && task.projectId !== projectFilter) return false;
      return true;
    });

    filtered.forEach(task => {
      const dates = parseTaskDates(task);
      if (!dates) {
        unsched.push(task);
      } else {
        const durationDays = Math.max(1, Math.round((dates.dueDate.getTime() - dates.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        let progress = task.progress ?? 0;
        if (task.status === 'done') progress = 100;

        sched.push({
          task,
          startDate: dates.startDate,
          dueDate: dates.dueDate,
          startKey: toDateKey(dates.startDate),
          dueKey: toDateKey(dates.dueDate),
          durationDays,
          progress,
        });
      }
    });

    return { scheduledTasks: sched, unscheduledTasks: unsched };
  }, [tasks, search, statusFilter, priorityFilter, projectFilter]);

  // Organize scheduled tasks into grouped buckets (O(N) single-pass)
  const groupedData = useMemo(() => {
    const groupsMap = new Map<string, { id: string; title: string; color?: string; items: TimelineTaskItem[] }>();

    if (groupBy === 'none') {
      // Flat list sorted by start date
      const sorted = [...scheduledTasks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      return [{ id: 'all', title: 'All Tasks', items: sorted }];
    }

    scheduledTasks.forEach(item => {
      let groupId = 'unassigned';
      let groupTitle = 'Unassigned';
      let color: string | undefined = undefined;

      if (groupBy === 'project') {
        if (item.task.project) {
          groupId = item.task.project.id;
          groupTitle = item.task.project.name;
          color = item.task.project.color;
        } else {
          groupId = 'no-project';
          groupTitle = 'No Project';
          color = '#94A3B8';
        }
      } else if (groupBy === 'status') {
        groupId = item.task.status;
        const cfg = statusColors[item.task.status as Status];
        groupTitle = cfg?.label || item.task.status;
        color = cfg?.bg;
      } else if (groupBy === 'assignee') {
        if (item.task.assignee) {
          groupId = item.task.assignee.id;
          groupTitle = item.task.assignee.name;
        } else {
          groupId = 'unassigned';
          groupTitle = 'Unassigned';
        }
      }

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, { id: groupId, title: groupTitle, color, items: [] });
      }
      groupsMap.get(groupId)!.items.push(item);
    });

    // Sort items inside each group chronologically
    const groups = Array.from(groupsMap.values());
    groups.forEach(g => {
      g.items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    });

    return groups;
  }, [scheduledTasks, groupBy]);

  // Auto-scroll to center "Today" line on initial render or viewScale change
  useEffect(() => {
    if (scrollContainerRef.current && todayLeftPx !== null) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = Math.max(0, todayLeftPx - containerWidth / 3);
      scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [viewScale, todayLeftPx]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    const shift = viewScale === 'days' ? -14 : viewScale === 'weeks' ? -28 : -60;
    setBaseDate(prev => addDays(prev, shift));
  }, [viewScale]);

  const handleNext = useCallback(() => {
    const shift = viewScale === 'days' ? 14 : viewScale === 'weeks' ? 28 : 60;
    setBaseDate(prev => addDays(prev, shift));
  }, [viewScale]);

  const handleToday = useCallback(() => {
    setBaseDate(startOfDay(new Date()));
    if (scrollContainerRef.current && todayLeftPx !== null) {
      const containerWidth = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, todayLeftPx - containerWidth / 3),
        behavior: 'smooth',
      });
    }
  }, [todayLeftPx]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Total canvas width
  const totalGridWidth = daysCount * colWidth;

  return (
    <div className="flex flex-col h-full bg-white text-[#111111] overflow-hidden select-none">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & CONTROLS TOOLBAR                          */}
      {/* ========================================================= */}
      <header className="shrink-0 border-b border-[#E5E7EB] bg-white px-3 md:px-6 py-2.5 md:py-3 space-y-2 md:space-y-3">
        {/* Row 1: Title, View Switcher & Action */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <h1 className="text-[15px] md:text-[17px] font-bold tracking-tight text-[#111111]">Timeline</h1>
                <span className="text-[10px] md:text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 md:px-2 py-0.5 rounded-full">
                  {scheduledTasks.length} scheduled
                </span>
                {unscheduledTasks.length > 0 && (
                  <button
                    onClick={() => setShowUnscheduledDrawer(prev => !prev)}
                    className="text-[10px] md:text-[11px] font-medium text-[#D97706] bg-[#FEF3C7] hover:bg-[#FDE68A] px-1.5 md:px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{unscheduledTasks.length} unscheduled</span>
                  </button>
                )}
              </div>
              {/* Subtitle — hidden on mobile to save space */}
              <p className="hidden md:block text-[11px] text-[#6B7280]">
                Chronological roadmap &amp; scheduling across all active projects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Today jump */}
            <button
              onClick={handleToday}
              className="px-2.5 py-1.5 text-[12px] font-medium text-[#374151] hover:text-[#111111] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>

            {/* Prev / Next controls */}
            <div className="flex items-center border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
              <button
                onClick={handlePrev}
                className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                aria-label="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="h-4 w-[1px] bg-[#E5E7EB]" />
              <button
                onClick={handleNext}
                className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                aria-label="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View scale segmented pill */}
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
              {(['days', 'weeks', 'months'] as ViewScale[]).map(scale => (
                <button
                  key={scale}
                  onClick={() => setViewScale(scale)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md capitalize transition-all cursor-pointer ${
                    viewScale === scale
                      ? 'bg-white text-[#111111] shadow-2xs font-bold'
                      : 'text-[#6B7280] hover:text-[#111111]'
                  }`}
                >
                  {scale}
                </button>
              ))}
            </div>

            {/* Create Task Button */}
            <button
              onClick={() => onCreateTask?.(todayKey)}
              className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Filters & Grouping — hidden on mobile, shown on sm+ */}
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-[#F3F4F6]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search timeline..."
                className="pl-8 pr-7 py-1 text-[11.5px] bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-lg focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none w-44 md:w-56 transition-all shadow-2xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="text-[11.5px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2 py-1 text-[#374151] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="all">All Projects</option>
              {allProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-[11.5px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2 py-1 text-[#374151] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-[11.5px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2 py-1 text-[#374151] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Group By selector */}
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#6B7280]">
            <SlidersHorizontal className="w-3 h-3 text-[#9CA3AF]" />
            <span>Group by:</span>
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-md">
              {(['project', 'status', 'assignee', 'none'] as GroupBy[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize cursor-pointer transition-colors ${
                    groupBy === g
                      ? 'bg-white text-[#111111] shadow-2xs font-semibold'
                      : 'text-[#6B7280] hover:text-[#111111]'
                  }`}
                >
                  {g === 'none' ? 'List' : g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. TIMELINE MAIN BODY (Left Task Tree + Right Gantt Canvas) */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: Fixed Task / Group Tree — hidden on mobile, visible sm+ */}
        <div className="hidden sm:flex sm:w-[240px] md:w-[280px] lg:w-[320px] shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFC] flex-col overflow-hidden z-10">
          {/* Header match height */}
          <div className="h-[60px] border-b border-[#E5E7EB] bg-white px-4 flex items-center justify-between text-[11px] font-bold text-[#6B7280] uppercase tracking-wider shrink-0">
            <span>Tasks & Milestones</span>
            <span className="font-mono text-[10px] text-[#9CA3AF] lowercase">
              {scheduledTasks.length} items
            </span>
          </div>


          {/* Tasks List aligned row-for-row with Timeline Grid */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F3F5]">
            {groupedData.map(group => {
              const isCollapsed = collapsedGroups.has(group.id);
              return (
                <div key={group.id} className="bg-white">
                  {/* Group Header Row */}
                  <div
                    onClick={() => toggleGroup(group.id)}
                    className="h-9 px-3.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] border-b border-[#E5E7EB] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[#9CA3AF]">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                      {group.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      <span className="text-[12px] font-bold text-[#111111] truncate">
                        {group.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#6B7280] bg-white border border-[#E5E7EB] px-1.5 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Task Rows inside Group */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[#F3F4F6]">
                      {group.items.map(item => {
                        const priCfg = priorityColors[item.task.priority as Priority] || { color: '#6B7280' };
                        const isDone = item.task.status === 'done';

                        return (
                          <div
                            key={item.task.id}
                            onClick={() => onTaskClick(item.task.id)}
                            className="h-11 px-3.5 flex items-center justify-between hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {/* Priority bar */}
                              <div
                                className="w-1 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: priCfg.color }}
                              />
                              <span
                                className={`text-[12px] truncate ${
                                  isDone
                                    ? 'line-through text-[#9CA3AF]'
                                    : 'font-medium text-[#111111] group-hover:text-[#2563EB]'
                                }`}
                              >
                                {item.task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Assignee Avatar */}
                              {item.task.assignee ? (
                                <div
                                  className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center overflow-hidden shrink-0"
                                  title={item.task.assignee.name}
                                >
                                  {item.task.assignee.avatar?.startsWith('http') || item.task.assignee.avatar?.startsWith('/') ? (
                                    <img src={item.task.assignee.avatar} alt={item.task.assignee.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                                  ) : (
                                    (item.task.assignee.avatar && item.task.assignee.avatar.length <= 3 ? item.task.assignee.avatar : item.task.assignee.name.slice(0, 2)).toUpperCase()
                                  )}
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-dashed border-[#D1D5DB] flex items-center justify-center text-[#9CA3AF]">
                                  <UserIcon className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {group.items.length === 0 && (
                        <div className="h-9 px-4 flex items-center text-[11px] text-[#9CA3AF] italic">
                          No scheduled tasks
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {scheduledTasks.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <Clock className="w-8 h-8 text-[#9CA3AF] mx-auto stroke-[1.5]" />
                <p className="text-[12px] font-medium text-[#374151]">No scheduled tasks</p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Set due dates on tasks to place them onto the timeline.
                </p>
                <button
                  onClick={() => onCreateTask?.(todayKey)}
                  className="mt-2 px-3 py-1.5 text-[11px] font-semibold bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8]"
                >
                  + Create Task
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Gantt Chart Canvas */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto bg-[#FFFFFF] relative scroll-smooth"
        >
          <div style={{ width: `${totalGridWidth}px`, minWidth: '100%' }} className="relative">
            {/* ------------------------------------------------------ */}
            {/* STICKY DATE RULER HEADER                               */}
            {/* ------------------------------------------------------ */}
            <div className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB] shadow-2xs">
              {/* Row 1: Month / Year Spans */}
              <div className="h-7 border-b border-[#F3F4F6] flex">
                {monthHeaders.map((m, idx) => (
                  <div
                    key={`${m.monthName}-${m.year}-${idx}`}
                    style={{ width: `${m.count * colWidth}px` }}
                    className="h-full px-2.5 flex items-center text-[11px] font-bold text-[#374151] border-r border-[#E5E7EB] truncate bg-[#FAFAFC]"
                  >
                    <span>{m.monthName} {m.year}</span>
                  </div>
                ))}
              </div>

              {/* Row 2: Day Columns */}
              <div className="h-8 flex">
                {dayColumns.map(col => (
                  <div
                    key={col.key}
                    style={{ width: `${colWidth}px` }}
                    onClick={() => onCreateTask?.(col.key)}
                    className={`h-full flex flex-col items-center justify-center border-r border-[#F3F4F6] transition-colors cursor-pointer hover:bg-[#EFF6FF] ${
                      col.isToday
                        ? 'bg-[#DBEAFE]/40 font-bold text-[#1D4ED8]'
                        : col.isWeekend
                        ? 'bg-[#F9FAFB] text-[#9CA3AF]'
                        : 'text-[#6B7280]'
                    }`}
                    title={`Click to add task on ${col.key}`}
                  >
                    {viewScale === 'days' ? (
                      <>
                        <span className="text-[8.5px] uppercase leading-none">{col.dayName.charAt(0)}</span>
                        <span className={`text-[10px] leading-tight ${col.isToday ? 'text-[#1D4ED8] font-bold' : ''}`}>
                          {col.dayNum}
                        </span>
                      </>
                    ) : (
                      <span className="text-[9px] font-mono leading-none">{col.dayNum}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------ */}
            {/* GRID CANVAS BODY                                       */}
            {/* ------------------------------------------------------ */}
            <div className="relative">
              {/* Vertical Today Line Marker spanning the full canvas */}
              {todayLeftPx !== null && (
                <div
                  style={{ left: `${todayLeftPx}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-[#2563EB] z-10 pointer-events-none"
                >
                  <div className="sticky top-[61px] -translate-x-1/2 bg-[#2563EB] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                    Today
                  </div>
                </div>
              )}

              {/* Render Rows mirroring the left-side items */}
              {groupedData.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);

                return (
                  <div key={group.id} className="border-b border-[#F3F4F6]">
                    {/* Group Canvas Track (matches group header height = 36px) */}
                    <div
                      className="h-9 bg-[#F9FAFB]/70 border-b border-[#E5E7EB] relative flex items-center"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const dayIdx = Math.floor(clickX / colWidth);
                        if (dayColumns[dayIdx]) {
                          onCreateTask?.(dayColumns[dayIdx].key);
                        }
                      }}
                    >
                      {/* Background Day vertical lines */}
                      {dayColumns.map(col => (
                        <div
                          key={`bg-${col.key}`}
                          style={{ left: `${dayColumns.indexOf(col) * colWidth}px`, width: `${colWidth}px` }}
                          className={`absolute inset-y-0 border-r border-[#F3F4F6] pointer-events-none ${
                            col.isWeekend ? 'bg-[#F9FAFB]' : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Task Bar Tracks (matches task row height = 44px) */}
                    {!isCollapsed &&
                      group.items.map(item => {
                        // Calculate horizontal coordinates
                        const startDiffDays =
                          (item.startDate.getTime() - windowStartDate.getTime()) / (1000 * 60 * 60 * 24);
                        const leftPx = startDiffDays * colWidth;
                        const widthPx = Math.max(colWidth * 0.9, item.durationDays * colWidth - 4);

                        const isDone = item.task.status === 'done';
                        const barColor =
                          item.task.project?.color ||
                          (statusColors[item.task.status as Status]?.bg || '#2563EB');

                        return (
                          <div
                            key={item.task.id}
                            className="h-11 relative flex items-center border-b border-[#F3F4F6] hover:bg-[#F8FAFC]/50 transition-colors"
                            onClick={(e) => {
                              // If clicked on empty space, open create task
                              if (e.target === e.currentTarget) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const dayIdx = Math.floor(clickX / colWidth);
                                if (dayColumns[dayIdx]) {
                                  onCreateTask?.(dayColumns[dayIdx].key);
                                }
                              }
                            }}
                          >
                            {/* Day Grid Lines */}
                            {dayColumns.map(col => (
                              <div
                                key={`bg-row-${col.key}`}
                                style={{ left: `${dayColumns.indexOf(col) * colWidth}px`, width: `${colWidth}px` }}
                                className={`absolute inset-y-0 border-r border-[#F3F4F6] pointer-events-none ${
                                  col.isWeekend ? 'bg-[#F9FAFB]/60' : ''
                                }`}
                              />
                            ))}

                            {/* GANTT TASK BAR */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(item.task.id);
                              }}
                              onMouseEnter={(e) => {
                                setHoveredTask(item.task);
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => setHoveredTask(null)}
                              className={`absolute h-7 rounded-lg shadow-2xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xs flex items-center justify-between px-2.5 overflow-hidden z-1 group ${
                                isDone ? 'opacity-70' : ''
                              }`}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx}px`,
                                backgroundColor: isDone ? '#E5E7EB' : `${barColor}20`,
                                border: `1.5px solid ${isDone ? '#9CA3AF' : barColor}`,
                              }}
                            >
                              {/* Inner Progress Track */}
                              <div
                                className="absolute inset-y-0 left-0 pointer-events-none rounded-l-md transition-all duration-300"
                                style={{
                                  width: `${item.progress}%`,
                                  backgroundColor: isDone ? '#9CA3AF' : barColor,
                                  opacity: isDone ? 0.4 : 0.35,
                                }}
                              />

                              {/* Bar Content */}
                              <div className="relative flex items-center gap-1.5 min-w-0 pr-1 z-1">
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                                ) : (
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: barColor }}
                                  />
                                )}
                                <span className="text-[11px] font-semibold text-[#111111] truncate leading-none">
                                  {item.task.title}
                                </span>
                              </div>

                              {/* Right end info inside bar */}
                              <div className="relative flex items-center gap-1.5 shrink-0 z-1">
                                {widthPx > 110 && (
                                  <span className="text-[9.5px] font-mono font-medium text-[#4B5563]">
                                    {item.progress}%
                                  </span>
                                )}
                                {item.task.assignee && (
                                  <div
                                    className="w-4.5 h-4.5 rounded-full bg-[#111111] text-white text-[8px] font-bold flex items-center justify-center overflow-hidden shrink-0"
                                    title={item.task.assignee.name}
                                  >
                                    {item.task.assignee.avatar?.startsWith('http') || item.task.assignee.avatar?.startsWith('/') ? (
                                      <img src={item.task.assignee.avatar} alt={item.task.assignee.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                                    ) : (
                                      (item.task.assignee.avatar && item.task.assignee.avatar.length <= 3 ? item.task.assignee.avatar : item.task.assignee.name.slice(0, 2)).toUpperCase()
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. UNSCHEDULED TASKS SLIDE-OVER DRAWER                    */}
        {/* ========================================================= */}
        {showUnscheduledDrawer && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-[#E5E7EB] shadow-xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAFAFC]">
              <div>
                <h3 className="text-[13px] font-bold text-[#111111]">Unscheduled Tasks</h3>
                <p className="text-[11px] text-[#6B7280]">
                  {unscheduledTasks.length} tasks without due dates
                </p>
              </div>
              <button
                onClick={() => setShowUnscheduledDrawer(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#111111] hover:bg-[#E5E7EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {unscheduledTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="p-3 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#2563EB] hover:shadow-xs transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#F3F4F6] text-[#374151]">
                      {task.status}
                    </span>
                  </div>
                  <h4 className="text-[12px] font-semibold text-[#111111] group-hover:text-[#2563EB] line-clamp-2">
                    {task.title}
                  </h4>
                  <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
                    <span className="text-[10px] text-[#2563EB] font-medium">Click to schedule &rarr;</span>
                    {task.project && (
                      <span
                        className="text-[10px] font-medium truncate max-w-[120px]"
                        style={{ color: task.project.color }}
                      >
                        {task.project.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {unscheduledTasks.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-center p-4 text-[#9CA3AF]">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981] mb-2" />
                  <p className="text-[12px] font-medium text-[#374151]">All tasks are scheduled!</p>
                  <p className="text-[11px]">Every task has a valid deadline on the roadmap.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. HOVER TOOLTIP CARD                                     */}
        {/* ========================================================= */}
        {hoveredTask && tooltipPos && (
          <div
            style={{
              position: 'fixed',
              left: `${Math.min(window.innerWidth - 260, tooltipPos.x + 15)}px`,
              top: `${Math.min(window.innerHeight - 180, tooltipPos.y + 15)}px`,
            }}
            className="z-50 bg-[#111111] text-white p-3 rounded-xl shadow-2xl pointer-events-none w-60 space-y-1.5 border border-white/10 backdrop-blur-md"
          >
            <div className="flex items-center justify-end text-[10px] text-gray-400">
              <span className="capitalize">{hoveredTask.priority}</span>
            </div>
            <p className="text-[12px] font-bold text-white line-clamp-2">
              {hoveredTask.title}
            </p>
            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-300">
              <span>Due: {hoveredTask.dueDate ? new Date(hoveredTask.dueDate).toLocaleDateString() : 'None'}</span>
              <span>Progress: {hoveredTask.progress || 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. FOOTER STATS & STATUS LEGEND                           */}
      {/* ========================================================= */}
      <footer className="shrink-0 border-t border-[#E5E7EB] bg-[#FAFAFC] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#6B7280]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            <span>Active Range: {dayColumns[0]?.key} &rarr; {dayColumns[dayColumns.length - 1]?.key}</span>
          </div>
          <span>&bull;</span>
          <span>Double-click or click any day to schedule</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6B7280]" />
            <span>Backlog</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span>To Do</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            <span>In Review</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>Done</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
