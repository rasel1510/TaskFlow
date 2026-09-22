import { useState } from 'react';
import { tasks, statusColors, priorityColors, getProjectName, type Status, type Task } from '../data/mockData';

interface KanbanBoardProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
}

const columns: { status: Status; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
];

function PriorityDot({ priority }: { priority: Task['priority'] }) {
  return <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: priorityColors[priority].color }} />;
}

function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const subtaskDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtaskTotal = task.subtasks?.length ?? 0;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-2.5 cursor-pointer hover:border-[#93C5FD] hover:shadow-sm transition-all group select-none"
    >
      {/* Priority bar */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.labels.slice(0, 2).map(label => (
            <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.5)]">{label}</span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <PriorityDot priority={task.priority} />
          <span className="text-[10px] text-[rgba(17,17,17,0.5)]">{priorityColors[task.priority].label}</span>
        </div>
      </div>

      <p className="text-[13px] font-medium text-[#111111] leading-snug mb-2.5">{task.title}</p>

      <div className="text-[11px] text-[rgba(17,17,17,0.4)] mb-2.5">{getProjectName(task.projectId)}</div>

      {subtaskTotal > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10.5px] text-[rgba(17,17,17,0.4)]">{subtaskDone}/{subtaskTotal} subtasks</span>
            <span className="text-[10.5px] text-[rgba(17,17,17,0.4)]">{Math.round((subtaskDone / subtaskTotal) * 100)}%</span>
          </div>
          <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${(subtaskDone / subtaskTotal) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5.5 h-5.5 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[9px] font-bold text-[#555]" style={{ width: 22, height: 22 }}>
            {task.assignee.avatar}
          </div>
          {task.dueDate && (
            <span className="text-[10.5px] text-[rgba(17,17,17,0.4)]">{task.dueDate.replace(', 2026', '')}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[rgba(17,17,17,0.35)]">
          {task.commentsCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {task.commentsCount}
            </span>
          )}
          {task.attachmentsCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              {task.attachmentsCount}
            </span>
          )}
          <span className="text-[10.5px]">{task.estimate}</span>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ onTaskClick, onCreateTask }: KanbanBoardProps) {
  const [search, setSearch] = useState('');

  const getColumnTasks = (status: Status) =>
    tasks.filter(t => t.status === status && (search === '' || t.title.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-[#E5E7EB] shrink-0">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#111111]">Project Board</h1>
          <p className="text-[11px] md:text-[12px] text-[rgba(17,17,17,0.45)]">All Projects</p>
        </div>
        <div className="flex items-center gap-2 md:ml-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search board..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none w-28 md:w-36"
            />
          </div>
          <button className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] text-[12.5px] text-[rgba(17,17,17,0.6)] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCreateTask} className="flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
      </div>

      {/* Board — horizontally scrollable on mobile */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 md:px-6 py-4 md:py-5">
        <div className="flex gap-3 md:gap-4 h-full" style={{ minWidth: columns.length * 260 }}>
          {columns.map(col => {
            const colTasks = getColumnTasks(col.status);
            const colors = statusColors[col.status];
            return (
              <div key={col.status} className="flex flex-col" style={{ width: 272, minWidth: 272 }}>
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span
                    className="text-[12px] font-semibold px-2 py-1 rounded-md"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {col.label}
                  </span>
                  <span className="text-[12px] font-semibold text-[rgba(17,17,17,0.35)]">{colTasks.length}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.35)] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] text-[rgba(17,17,17,0.35)] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto bg-[#F9FAFB] rounded-xl p-2.5">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24 text-center">
                      <p className="text-[12px] text-[rgba(17,17,17,0.3)]">No tasks</p>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
                    ))
                  )}
                  <button
                    onClick={onCreateTask}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-[12.5px] text-[rgba(17,17,17,0.4)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
