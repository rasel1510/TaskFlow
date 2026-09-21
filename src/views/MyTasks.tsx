'use client';

import { useState } from 'react';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { statusColors, priorityColors, type Status, type Priority } from '../data/mockData';

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

function PriorityIcon({ priority }: { priority: string }) {
  const safe = (priority in priorityColors ? priority : 'medium') as Priority;
  const color = priorityColors[safe].color;
  if (safe === 'urgent') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {safe === 'high' && <><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></>}
      {safe === 'medium' && <><line x1="5" y1="12" x2="19" y2="12"/></>}
      {safe === 'low' && <><polyline points="17 13 12 18 7 13"/><line x1="12" y1="6" x2="12" y2="18"/></>}
    </svg>
  );
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function MyTasks({ onTaskClick, onCreateTask }: MyTasksProps) {
  const { tasks, isLoading } = useTasks();
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered: DBTask[] = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
      <div className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[24px] font-bold text-[#111111]">My Tasks</h1>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mt-0.5">
              {isLoading ? 'Loading...' : `${tasks.length} total tasks`}
            </p>
          </div>
          <button
            onClick={onCreateTask}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Task
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] flex-1 max-w-xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-0.5 p-0.5 bg-[#F3F4F6] rounded-lg">
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value as Status | 'all')}
                className={`px-3 py-1 rounded-md text-[12.5px] font-medium transition-colors ${
                  statusFilter === s.value
                    ? 'bg-white text-[#111111] shadow-sm'
                    : 'text-[rgba(17,17,17,0.5)] hover:text-[#111111]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto text-[12.5px] text-[rgba(17,17,17,0.5)]">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filter
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Sort
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 mb-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
            <span className="text-[13px] font-medium text-[#2563EB]">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-3">
              {['Set Status', 'Set Priority', 'Assign', 'Archive', 'Delete'].map(action => (
                <button key={action} className={`text-[12.5px] px-2.5 py-1 rounded-md border transition-colors ${action === 'Delete' ? 'border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]' : 'border-[#BFDBFE] text-[#2563EB] hover:bg-white'}`}>
                  {action}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-[#2563EB] hover:underline text-[12.5px]">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11.5px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-[#D1D5DB] accent-[#2563EB]"
            />
            <span className="flex-1">Task</span>
            <span className="w-32">Project</span>
            <span className="w-28">Status</span>
            <span className="w-24">Priority</span>
            <span className="w-28">Assignee</span>
            <span className="w-28">Due Date</span>
            <span className="w-16">Est.</span>
            <span className="w-8" />
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-[rgba(17,17,17,0.4)]">
              <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mr-2" />
              Loading tasks...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" className="mb-3">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <p className="text-[14px] font-medium text-[rgba(17,17,17,0.4)]">No tasks found</p>
              <p className="text-[12.5px] text-[rgba(17,17,17,0.3)] mt-1">
                {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first task to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <button
                  onClick={onCreateTask}
                  className="mt-4 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors"
                >
                  Create Task
                </button>
              )}
            </div>
          ) : (
            filtered.map((task, i) => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[#F9FAFB] group ${
                  selected.has(task.id) ? 'bg-[#FAFBFF]' : ''
                } ${i < filtered.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(task.id)}
                  onClick={e => toggleSelect(task.id, e)}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-[#D1D5DB] accent-[#2563EB]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13.5px] font-medium text-[#111111] truncate ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                      {task.title}
                    </span>
                    {task.labels.slice(0, 2).map(label => (
                      <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.5)] shrink-0 hidden group-hover:inline-block">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-[rgba(17,17,17,0.4)] mt-0.5">{task.taskNumber ?? task.id}</div>
                </div>

                <span className="w-32 text-[12.5px] text-[rgba(17,17,17,0.6)] truncate">
                  {task.project?.name ?? '—'}
                </span>

                <div className="w-28">
                  <span
                    className="text-[11px] font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: sc(task.status).bg, color: sc(task.status).text }}
                  >
                    {sc(task.status).label}
                  </span>
                </div>

                <div className="w-24 flex items-center gap-1.5">
                  <PriorityIcon priority={task.priority} />
                  <span className="text-[12.5px] text-[rgba(17,17,17,0.7)]">{pc(task.priority).label}</span>
                </div>

                <div className="w-28 flex items-center gap-2">
                  {task.assignee ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                        {task.assignee.avatar}
                      </div>
                      <span className="text-[12.5px] text-[rgba(17,17,17,0.7)] truncate">
                        {task.assignee.name.split(' ')[0]}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-[rgba(17,17,17,0.35)]">Unassigned</span>
                  )}
                </div>

                <span className="w-28 text-[12.5px] text-[rgba(17,17,17,0.6)]">{formatDate(task.dueDate)}</span>
                <span className="w-16 text-[12.5px] text-[rgba(17,17,17,0.5)]">{task.estimate ?? '—'}</span>

                <button
                  onClick={e => e.stopPropagation()}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.35)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[12.5px] text-[rgba(17,17,17,0.4)]">
            Showing {filtered.length} of {tasks.length} tasks
          </span>
        </div>
      </div>
    </div>
  );
}
