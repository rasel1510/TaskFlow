'use client';

/**
 * src/views/KanbanBoard.tsx
 *
 * Interactive Kanban Board with @dnd-kit Drag-and-Drop.
 *
 * Architecture:
 * - Columns act as droppable zones for task status buckets.
 * - Cards are draggable with a 5px movement activation constraint to preserve clickability.
 * - DragOverlay renders a weighted ghost card during flight (Linear-like elevation & slight tilt).
 * - Automatic optimistic status update + toast notification + background sync via TaskContext.
 */

import React, { useState } from 'react';
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
  return <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />;
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
  const subtaskDone = task.subtasks?.filter(s => s.done).length ?? 0;
  const subtaskTotal = task.subtasks?.length ?? 0;
  const pConfig = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium;
  const labels = Array.isArray(task.labels) ? task.labels : [];

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 mb-2.5 select-none transition-all ${
        isOverlay
          ? 'border-[#2563EB] shadow-2xl rotate-1 scale-105 cursor-grabbing z-50 ring-2 ring-[#DBEAFE]'
          : 'border-[#E5E7EB] hover:border-[#93C5FD] hover:shadow-sm cursor-grab group active:cursor-grabbing'
      }`}
    >
      {/* Priority & Labels */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.55)] border border-[#E5E7EB]">
            {task.taskNumber ?? task.id}
          </span>
          {labels.slice(0, 2).map(label => (
            <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[rgba(17,17,17,0.5)]">
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PriorityDot priority={task.priority} />
          <span className="text-[10px] text-[rgba(17,17,17,0.5)]">{pConfig.label}</span>
        </div>
      </div>

      <p className="text-[13px] font-medium text-[#111111] leading-snug mb-2.5 break-words">{task.title}</p>

      <div className="text-[11px] text-[rgba(17,17,17,0.4)] mb-2.5 truncate">
        {task.project?.name ?? getProjectName(task.projectId)}
      </div>

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

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center text-[8.5px] font-bold text-white shrink-0">
            {task.assignee?.avatar ?? 'ME'}
          </div>
          {task.dueDate && (
            <span className="text-[10.5px] text-[rgba(17,17,17,0.4)]">
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[rgba(17,17,17,0.35)]">
          {(task.commentsCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10.5px]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {task.commentsCount}
            </span>
          )}
          {task.estimate && <span className="text-[10.5px]">{task.estimate}</span>}
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
}: {
  status: Status;
  label: string;
  tasks: DBTask[];
  isLoading?: boolean;
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const colors = statusColors[status] || statusColors.todo;

  return (
    <div className="flex flex-col snap-center md:snap-align-none" style={{ width: 272, minWidth: 272 }}>
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span
          className="text-[12px] font-semibold px-2 py-1 rounded-md"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {label}
        </span>
        <span className="text-[12px] font-semibold text-[rgba(17,17,17,0.35)]">
          {isLoading ? '...' : tasks.length}
        </span>
      </div>

      {/* Droppable Drop Zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto rounded-xl p-2.5 transition-colors duration-150 min-h-[350px] ${
          isOver ? 'bg-[#EFF6FF] ring-2 ring-[#93C5FD] ring-offset-1' : 'bg-[#F9FAFB]'
        }`}
      >
        {isLoading ? (
          <div>
            <KanbanCardSkeleton />
            <KanbanCardSkeleton />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-28 text-center select-none">
            <p className="text-[12px] text-[rgba(17,17,17,0.3)]">No tasks</p>
          </div>
        ) : (
          tasks.map(task => (
            <DraggableCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))
        )}

        <button
          onClick={onCreateTask}
          className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-[12.5px] text-[rgba(17,17,17,0.4)] hover:bg-[#F3F4F6] hover:text-[#111111] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
  const [activeTask, setActiveTask] = useState<DBTask | null>(null);

  // Set up pointer sensor with 5px distance constraint to ensure clicks aren't intercepted as drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const getColumnTasks = (status: Status) =>
    tasks.filter(t => t.status === status && (search === '' || t.title.toLowerCase().includes(search.toLowerCase())));

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
      <div className="flex flex-wrap items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-[#E5E7EB] shrink-0">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#111111]">Project Board</h1>
          <p className="text-[11px] md:text-[12px] text-[rgba(17,17,17,0.45)]">All Projects</p>
        </div>
        <div className="flex items-center gap-2 md:ml-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search board..."
              className="bg-transparent text-[13px] text-[#111111] placeholder-[#9CA3AF] outline-none w-28 md:w-36"
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
      </div>

      {/* Dnd Board Container */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 md:px-6 py-4 md:py-5 snap-x snap-mandatory md:snap-none">
          <div className="flex gap-3 md:gap-4 h-full" style={{ minWidth: columns.length * 260 }}>
            {columns.map(col => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={getColumnTasks(col.status)}
                isLoading={isLoading}
                onTaskClick={onTaskClick}
                onCreateTask={onCreateTask}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay Ghost Card */}
        <DragOverlay>
          {activeTask ? (
            <div style={{ width: 252 }}>
              <KanbanCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
