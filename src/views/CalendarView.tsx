'use client';

import React, { useState, useMemo } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { statusColors, priorityColors, type Status, type Priority } from '@/data/mockData';

interface CalendarViewProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask?: (prefillDate?: string) => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarView({ onTaskClick, onCreateTask }: CalendarViewProps) {
  const { tasks, isLoading } = useTasks();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const today = useMemo(() => new Date(), []);

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

  // Index tasks by date string "YYYY-MM-DD" for O(1) cell lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DBTask[]>();
    for (const task of filteredTasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    }
    return map;
  }, [filteredTasks]);

  // Current month metadata
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    // Convert Sunday (0) to 7, Monday is 1
    let startDayOfWeek = firstDayOfMonth.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7;

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateKey: string;
    }[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i + 1);
      const dateKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday:
          prevDate.getDate() === today.getDate() &&
          prevDate.getMonth() === today.getMonth() &&
          prevDate.getFullYear() === today.getFullYear(),
        dateKey,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const thisDate = new Date(year, month, d);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: thisDate,
        isCurrentMonth: true,
        isToday:
          d === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
        dateKey,
      });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday:
          nextDate.getDate() === today.getDate() &&
          nextDate.getMonth() === today.getMonth() &&
          nextDate.getFullYear() === today.getFullYear(),
        dateKey,
      });
    }

    return days;
  }, [year, month, today]);

  // Week days for Week view
  const weekDays = useMemo(() => {
    // Start of the week containing currentDate (Monday)
    const current = new Date(currentDate);
    let day = current.getDay();
    if (day === 0) day = 7;
    current.setDate(current.getDate() - (day - 1));

    const days: {
      date: Date;
      isToday: boolean;
      dateKey: string;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        isToday:
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear(),
        dateKey,
      });
    }

    return days;
  }, [currentDate, today]);

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
    setCurrentDate(new Date());
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Top Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-4 border-b border-[#E5E7EB] bg-white shrink-0">
        {/* Left: Navigation and Month Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[rgba(17,17,17,0.6)] hover:text-[#111111] transition-colors"
              aria-label="Previous"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[rgba(17,17,17,0.6)] hover:text-[#111111] transition-colors"
              aria-label="Next"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <h2 className="text-[18px] font-bold text-[#111111] tracking-tight">
            {monthName} {year}
          </h2>

          <button
            onClick={handleToday}
            className="text-[12px] font-medium text-[#2563EB] hover:bg-[#EFF6FF] px-2.5 py-1 rounded-md transition-colors"
          >
            Today
          </button>
        </div>

        {/* Right: Filters & View Switch */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[13px]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="bg-transparent text-[#111111] placeholder-[#9CA3AF] outline-none w-28 sm:w-36"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-[12px] border border-[#E5E7EB] rounded-lg px-2.5 py-1 bg-white text-[#111111] outline-none cursor-pointer hover:border-[#CBD5E1]"
          >
            <option value="all">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>

          {/* Month / Week Switch */}
          <div className="flex items-center p-0.5 bg-[#F3F4F6] rounded-lg">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                viewMode === 'week'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0 text-center py-2">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="text-[10px] sm:text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day[0]}</span>
            </div>
          ))}
        </div>

        {/* View Mode: Month */}
        {viewMode === 'month' && (
          <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 divide-x divide-y divide-[#E5E7EB] overflow-y-auto">
            {calendarDays.map((cell, idx) => {
              const dayTasks = tasksByDate.get(cell.dateKey) || [];

              return (
                <div
                  key={idx}
                  className={`min-h-[90px] md:min-h-[110px] p-1.5 md:p-2 flex flex-col transition-colors group relative ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-[#FAFAFB] text-[rgba(17,17,17,0.35)]'
                  }`}
                >
                  {/* Cell Header: Day number + Add task trigger */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[12px] font-semibold flex items-center justify-center rounded-full w-6 h-6 ${
                        cell.isToday
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-[#111111]'
                          : 'text-[#9CA3AF]'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {/* Quick Add Task button on hover */}
                    {onCreateTask && (
                      <button
                        onClick={() => onCreateTask(cell.dateKey)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all"
                        title="Add task on this day"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Tasks List in Cell */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayTasks.slice(0, 3).map(task => {
                      const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280' };
                      const priorityCfg = priorityColors[task.priority as Priority] || { color: '#6B7280' };

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] cursor-pointer transition-all hover:border-[#CBD5E1] shadow-2xs truncate"
                          title={`${task.taskNumber ? task.taskNumber + ': ' : ''}${task.title}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: priorityCfg.color }}
                          />
                          <span className="truncate text-[#111111]">
                            {task.taskNumber && (
                              <span className="font-mono text-[10px] text-[#6B7280] mr-1">
                                {task.taskNumber}
                              </span>
                            )}
                            {task.title}
                          </span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 3 && (
                      <div className="text-[10px] font-semibold text-[#2563EB] px-1.5 py-0.5">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode: Week */}
        {viewMode === 'week' && (
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[660px] h-full grid grid-cols-7 divide-x divide-[#E5E7EB] overflow-y-auto">
              {weekDays.map((cell, idx) => {
              const dayTasks = tasksByDate.get(cell.dateKey) || [];

              return (
                <div
                  key={idx}
                  className={`flex flex-col p-3 transition-colors ${
                    cell.isToday ? 'bg-[#F8FAFF]' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[14px] font-bold flex items-center justify-center rounded-full w-7 h-7 ${
                          cell.isToday
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-[#111111]'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      <span className="text-[12px] font-medium text-[rgba(17,17,17,0.5)]">
                        {cell.date.toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                      {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {dayTasks.map(task => {
                      const statusCfg = statusColors[task.status as Status] || { bg: '#F3F4F6', text: '#6B7280', label: task.status };
                      const priorityCfg = priorityColors[task.priority as Priority] || { color: '#6B7280', label: task.priority };

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task.id)}
                          className="p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#93C5FD] hover:shadow-xs bg-white cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            {task.taskNumber && (
                              <span className="font-mono text-[10px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
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

                          <h4 className="text-[12.5px] font-medium text-[#111111] line-clamp-2">
                            {task.title}
                          </h4>

                          {task.project && (
                            <div className="flex items-center gap-1 text-[11px] text-[rgba(17,17,17,0.5)] truncate">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: task.project.color }}
                              />
                              <span className="truncate">{task.project.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {dayTasks.length === 0 && (
                      <div className="h-28 flex items-center justify-center text-[11px] text-[rgba(17,17,17,0.3)] border border-dashed border-[#E5E7EB] rounded-xl">
                        No scheduled tasks
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
    </div>
  );
}
