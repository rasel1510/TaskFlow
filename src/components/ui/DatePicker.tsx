'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
  align?: 'left' | 'right';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return isoDate;
  const mName = MONTH_NAMES[monthIdx]?.slice(0, 3) || '';
  return `${mName} ${day}, ${year}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  align = 'right',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll into view when opened on mobile screens
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Initialize view year & month from value or today
  const initialDate = value ? new Date(value) : new Date();
  const validInitial = !isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [viewYear, setViewYear] = useState(validInitial.getFullYear());
  const [viewMonth, setViewMonth] = useState(validInitial.getMonth());

  // Keep view year & month in sync when value changes
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const yStr = String(today.getFullYear());
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Calendar calculations
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  let selectedY = -1;
  let selectedM = -1;
  let selectedD = -1;
  if (value) {
    const p = value.split('-');
    if (p.length === 3) {
      selectedY = parseInt(p[0], 10);
      selectedM = parseInt(p[1], 10) - 1;
      selectedD = parseInt(p[2], 10);
    }
  }

  // Generate grid days
  const prevMonthDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  const currentMonthDays = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentMonthDays.push(i);
  }

  const totalDisplayed = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = totalDisplayed % 7 === 0 ? 0 : 7 - (totalDisplayed % 7);
  const nextMonthDays = [];
  for (let i = 1; i <= nextMonthDaysCount; i++) {
    nextMonthDays.push(i);
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full max-w-full flex items-center justify-between text-[15px] sm:text-[13px] border rounded-lg px-3 py-2.5 sm:py-2 bg-white transition-all min-h-[42px] sm:min-h-0 cursor-pointer ${
          isOpen
            ? 'border-[#2563EB] ring-2 ring-[#DBEAFE]'
            : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
        } ${className}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-[#111111] font-medium' : 'text-[#9CA3AF]'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-colors ${isOpen ? 'text-[#2563EB]' : 'text-gray-400'}`}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3 select-none animate-in fade-in zoom-in-95 duration-100 left-0 right-0 w-full ${
            align === 'left' ? 'sm:w-[280px] sm:left-0 sm:right-auto' : 'sm:w-[280px] sm:left-auto sm:right-0'
          }`}
          role="dialog"
          aria-label="Calendar date picker"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[14px] sm:text-[13.5px] font-semibold text-[#111111]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((wd, i) => (
              <span key={i} className="text-[11px] font-semibold text-slate-400 py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Previous month days */}
            {prevMonthDays.map((d, i) => (
              <div
                key={`prev-${i}`}
                className="h-8 flex items-center justify-center text-[12px] text-slate-300 pointer-events-none"
              >
                {d}
              </div>
            ))}

            {/* Current month days */}
            {currentMonthDays.map(d => {
              const isSelected =
                viewYear === selectedY && viewMonth === selectedM && d === selectedD;
              const isToday =
                viewYear === todayY && viewMonth === todayM && d === todayD;

              return (
                <button
                  key={`cur-${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`h-8 rounded-lg flex items-center justify-center text-[13px] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                      : isToday
                      ? 'border border-[#2563EB] text-[#2563EB] font-bold hover:bg-blue-50'
                      : 'text-[#111111] hover:bg-slate-100 active:bg-slate-200'
                  }`}
                >
                  {d}
                </button>
              );
            })}

            {/* Next month days */}
            {nextMonthDays.map((d, i) => (
              <div
                key={`next-${i}`}
                className="h-8 flex items-center justify-center text-[12px] text-slate-300 pointer-events-none"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-[12.5px]">
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-900 font-medium transition-colors cursor-pointer px-1 py-0.5"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold transition-colors cursor-pointer px-1 py-0.5"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
