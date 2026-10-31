'use client';

/**
 * src/views/KanbanBoard.tsx
 *
 * Interactive Kanban Board with @dnd-kit Drag-and-Drop.
 *
 * Architecture & Enhancements:
 * - Adaptive layout modes:
 *   - 'fit' (default): Fluid responsive columns (flex-1 min-w-[185px]) that fit all 5 columns
 *     (Backlog, To Do, In Progress, In Review, Done) on standard laptop and desktop screens with zero cut-off.
 *   - 'wide': Fixed-width columns (272px) with smooth horizontal scrolling for dense workflows.
 * - Columns act as droppable zones for task status buckets.
 * - Cards are draggable with a 5px movement activation constraint to preserve clickability.
 * - DragOverlay renders a weighted ghost card during flight (Linear-like elevation & slight tilt).
 * - Automatic optimistic status update + toast notification + background sync via TaskContext.
 * - Full project filtering, search matching, and keyboard accessibility.
 */

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTasks, type DBTask } from '@/context/TaskContext';
import { statusColors, priorityColors, getProjectName, type Status } from '../data/mockData';
import { KanbanCardSkeleton } from '@/components/ui/Skeleton';

interface KanbanBoardProps {
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
}

const columns: { status: Status; label: string }[] = [
  { status: 'backlog',     label: 'Backlog' },
  { status: 'todo',        label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review',   label: 'In Review' },
  { status: 'done',        label: 'Done' },
];

function PriorityDot({ priority }: { priority: string }) {
  const p = priorityColors[priority as keyof typeof priorityColors] || priorityColors.medium;
  return <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: p.color }} />;
}

// ---------------------------------------------------------------------------
// Pure Presentation Card
// ---------------------------------------------------------------------------

function KanbanCard({
  task,
  onClick,
  isOverlay = false,
}: {
  task: DBTask;
  onClick?: () => void;
  isOverlay?: boolean;
}) {
  const pConfig = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium;
  const labels = Array.isArray(task.labels) ? task.labels : [];

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-3.5 mb-2.5 select-none transition-all shadow-xs ${
        isOverlay
          ? 'border-[#2563EB] shadow-2xl rotate-1 scale-105 cursor-grabbing z-50 ring-2 ring-[#DBEAFE]'
          : 'border-[#E5E7EB] hover:border-[#93C5FD] hover:shadow-sm cursor-grab group active:cursor-grabbing'
      }`}
    >
      {/* Priority & Labels */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {labels.slice(0, 1).map(label => (
            <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.5)] truncate max-w-[80px]">
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PriorityDot priority={task.priority} />
          <span className="text-[10.5px] text-[rgba(17,17,17,0.5)] capitalize">{pConfig.label}</span>
        </div>
      </div>

      <p className="text-[13px] font-medium text-[#111111] leading-snug mb-1.5 break-words line-clamp-2">{task.title}</p>

      <div className="text-[11px] text-[rgba(17,17,17,0.45)] mb-2.5 truncate">
        {task.project?.name ?? getProjectName(task.projectId)}
      </div>



      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6] text-[rgba(17,17,17,0.45)]">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-[8.5px] font-bold text-white shrink-0">
            {task.assignee?.avatar ?? 'ME'}
          </div>
          {task.dueDate && (
            <span className="text-[10.5px] truncate">
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[rgba(17,17,17,0.4)] shrink-0">
          {(task.commentsCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {task.commentsCount}
            </span>
          )}
          {task.estimate && <span className="text-[10.5px] font-mono">{task.estimate}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draggable Card Wrapper
// ---------------------------------------------------------------------------

function DraggableCard({ task, onClick }: { task: DBTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    transition: transform ? 'transform 0ms' : 'transform 150ms ease-out',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} onClick={onClick} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable Column Component
// ---------------------------------------------------------------------------

function KanbanColumn({
  status,
  label,
  tasks,
  isLoading,
  onTaskClick,
  onCreateTask,
  layoutMode,
}: {
  status: Status;
  label: string;
  tasks: DBTask[];
  isLoading?: boolean;
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
  layoutMode: 'fit' | 'wide';
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const colors = statusColors[status] || statusColors.todo;

  return (
    <div
      id={`kanban-col-${status}`}
      className={`flex flex-col h-full snap-center md:snap-align-none transition-[width,min-width] duration-150 ${
        layoutMode === 'fit'
          ? 'w-[82vw] min-w-[270px] sm:w-auto sm:flex-1 sm:min-w-[185px] max-w-full shrink-0 sm:shrink'
          : 'w-[272px] min-w-[272px] shrink-0'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 px-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[12px] font-semibold px-2 py-0.5 rounded-md truncate"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {label}
          </span>
          <span className="text-[12px] font-semibold text-[rgba(17,17,17,0.35)] shrink-0">
            {isLoading ? '...' : tasks.length}
          </span>
        </div>
        <button
          onClick={onCreateTask}
          title={`Add task to ${label}`}
          className="w-5 h-5 flex items-center justify-center rounded text-[rgba(17,17,17,0.4)] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Droppable Drop Zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col overflow-y-auto rounded-xl p-2 md:p-2.5 transition-all duration-150 min-h-[300px] ${
          isOver ? 'bg-[#EFF6FF] ring-2 ring-[#93C5FD] ring-offset-1' : 'bg-[#F9FAFB] border border-[#F3F4F6]'
        }`}
      >
        <div className="flex-1 space-y-2">
          {isLoading ? (
            <div>
              <KanbanCardSkeleton />
              <KanbanCardSkeleton />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 text-center select-none rounded-lg border border-dashed border-[#E5E7EB] bg-white/50 my-1">
              <p className="text-[12px] text-[rgba(17,17,17,0.35)]">No tasks</p>
            </div>
          ) : (
            tasks.map(task => (
              <DraggableCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))
          )}
        </div>

        <button
          onClick={onCreateTask}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 rounded-lg text-[12px] text-[rgba(17,17,17,0.45)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add task
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Kanban Board View
// ---------------------------------------------------------------------------

export default function KanbanBoard({ onTaskClick, onCreateTask }: KanbanBoardProps) {
  const { tasks, isLoading, updateTaskStatus } = useTasks();
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [layoutMode, setLayoutMode] = useState<'fit' | 'wide'>('fit');
  const [activeTask, setActiveTask] = useState<DBTask | null>(null);

  // Set up pointer sensor with 5px distance constraint to ensure clicks aren't intercepted as drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Extract unique projects from tasks for filter with O(N) complexity
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.projectId) {
        const name = t.project?.name ?? getProjectName(t.projectId);
        map.set(t.projectId, name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const getColumnTasks = (status: Status) =>
    tasks.filter(t => {
      const matchStatus = t.status === status;
      const matchSearch = search === '' || t.title.toLowerCase().includes(search.toLowerCase());
      const matchProject = selectedProjectId === 'all' || t.projectId === selectedProjectId;
      return matchStatus && matchSearch && matchProject;
    });

  const totalFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch = search === '' || t.title.toLowerCase().includes(search.toLowerCase());
      const matchProject = selectedProjectId === 'all' || t.projectId === selectedProjectId;
      return matchSearch && matchProject;
    }).length;
  }, [tasks, search, selectedProjectId]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id) ?? null;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // Determine target status
    let targetStatus: Status | null = null;

    // Direct drop onto column container
    if (columns.some(c => c.status === overId)) {
      targetStatus = overId as Status;
    } else {
      // Dropped onto another task card: take that task's status
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status as Status;
      }
    }

    if (!targetStatus) return;

    const currentTask = tasks.find(t => t.id === taskId);
    if (currentTask && currentTask.status !== targetStatus) {
      updateTaskStatus(taskId, targetStatus);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3.5 border-b border-[#E5E7EB] shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] md:text-[20px] font-bold text-[#111111]">Project Board</h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[rgba(17,17,17,0.6)]">
                {totalFilteredTasks} {totalFilteredTasks === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            {/* Project Filter */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="text-[11.5px] text-[rgba(17,17,17,0.55)] bg-transparent hover:text-[#111111] font-medium outline-none cursor-pointer pr-1 transition-colors"
                aria-label="Filter tasks by project"
              >
                <option value="all">All Projects</option>
                {uniqueProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Search box */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-lg bg-[#F9FAFB] focus-within:bg-white focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] transition-all shadow-2xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search board..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none border-none focus:outline-none focus:ring-0 w-28 sm:w-36 md:w-48"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] hover:bg-[#E5E7EB] transition-colors shrink-0"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Layout Mode Toggle */}
          <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] text-[12px]">
            <button
              onClick={() => setLayoutMode('fit')}
              title="Fit all columns to screen width"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'fit'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[rgba(17,17,17,0.55)] hover:text-[#111111]'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M7.5 3v18M12 3v18M16.5 3v18"/>
              </svg>
              <span className="hidden md:inline">Fit Screen</span>
            </button>
            <button
              onClick={() => setLayoutMode('wide')}
              title="Wide columns with horizontal scroll"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === 'wide'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[rgba(17,17,17,0.55)] hover:text-[#111111]'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8L22 12L18 16"/>
                <path d="M6 8L2 12L6 16"/>
                <path d="M2 12H22"/>
              </svg>
              <span className="hidden md:inline">Wide</span>
            </button>
          </div>

          {/* Add Task Button */}
          <button
            onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs active:scale-[0.98]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
      </div>

      {/* Mobile Column Quick Jump Pills */}
      <div className="md:hidden flex items-center gap-1.5 px-3.5 py-2 border-b border-[#E5E7EB] bg-[#FAFAFB] overflow-x-auto no-scrollbar shrink-0">
        {columns.map(col => {
          const count = getColumnTasks(col.status).length;
          const colors = statusColors[col.status] || statusColors.todo;
          return (
            <button
              key={col.status}
              onClick={() => {
                const el = document.getElementById(`kanban-col-${col.status}`);
                el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-white border border-[#E5E7EB] shadow-2xs whitespace-nowrap shrink-0 active:bg-gray-100"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text }} />
              <span>{col.label}</span>
              <span className="text-[10px] text-gray-400 font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Dnd Board Container */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 md:px-6 py-4 md:py-5 snap-x snap-mandatory md:snap-none">
          <div
            className={`flex gap-3 md:gap-3.5 h-full ${
              layoutMode === 'fit'
                ? 'w-full min-w-full'
                : 'w-max min-w-full'
            }`}
          >
            {columns.map(col => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={getColumnTasks(col.status)}
                isLoading={isLoading}
                onTaskClick={onTaskClick}
                onCreateTask={onCreateTask}
                layoutMode={layoutMode}
              />
            ))}
            {/* Right padding buffer for smooth horizontal scroll in wide mode */}
            {layoutMode === 'wide' && <div className="w-2 shrink-0" aria-hidden="true" />}
          </div>
        </div>

        {/* Drag Overlay Ghost Card */}
        <DragOverlay>
          {activeTask ? (
            <div className="w-[230px] max-w-full pointer-events-none">
              <KanbanCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
