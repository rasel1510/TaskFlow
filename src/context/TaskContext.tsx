'use client';




import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface DBUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export interface DBSubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface DBProject {
  id: string;
  name: string;
  description: string;
  color: string;
  health: string;
  progress: number;
}

export interface DBTask {
  id: string;
  taskNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimate: string | null;
  labels: string[];
  progress: number | null;
  commentsCount: number;
  attachmentsCount: number;
  createdAt: string;
  projectId: string;
  assigneeId: string | null;
  assignee: DBUser | null;
  project: DBProject | null;
  subtasks: DBSubTask[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  projectId?: string;
  assigneeId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string;
  estimate?: string;
  labels?: string[];
}

interface TaskContextValue {
  tasks: DBTask[];
  users: DBUser[];
  isLoading: boolean;
  error: string | null;
  createTask: (payload: CreateTaskPayload) => Promise<DBTask>;
  updateTaskStatus: (taskId: string, status: string) => Promise<void>;
  updateTask: (taskId: string, payload: Partial<CreateTaskPayload>) => Promise<DBTask>;
  deleteTask: (taskId: string) => Promise<void>;
  createSubtask: (taskId: string, title: string) => Promise<DBSubTask>;
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const sessionUserId = (session?.user as { id?: string })?.id;
  const toast = useToast();
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (!sessionUserId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`/api/tasks?userId=${encodeURIComponent(sessionUserId)}`, { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const envelope = await res.json();
      // Handle both old raw-array and new { success, data } envelope shapes
      const data: DBTask[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      // Ensure only this user's tasks are stored in state
      setTasks(data.filter(t => t.assigneeId === sessionUserId));
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskContext] fetchTasks error:', err);
      setError('Failed to load tasks. Please refresh.');
    }
  }, [sessionUserId]);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
      const data: DBUser[] = await res.json();
      setUsers(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskContext] fetchUsers error:', err);
    }
  }, []);

  // Initial and reactive load whenever session changes — AbortController cleanup (Step 4.13)
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    Promise.all([fetchTasks(controller.signal), fetchUsers(controller.signal)])
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [fetchTasks, fetchUsers, sessionUserId]);

  const refreshTasks = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (payload: CreateTaskPayload): Promise<DBTask> => {
    // Strictly bind assignee to the active logged-in user who created the task
    const activeUserId = (session?.user as { id?: string })?.id;
    const finalPayload = {
      ...payload,
      assigneeId: activeUserId || payload.assigneeId,
    };

    const qs = activeUserId ? `?userId=${encodeURIComponent(activeUserId)}` : '';
    try {
      const res = await fetch(`/api/tasks${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const message = errBody?.error?.message || errBody?.message || `Create task failed: ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }

      const envelope = await res.json();
      // Unwrap { success, data } envelope; fall back to raw object for compatibility
      const newTask: DBTask = envelope?.data ?? envelope;

      // Optimistically prepend to state so it appears instantly
      setTasks(prev => [newTask, ...prev]);
      toast.success(`Task "${newTask.title}" created successfully`);
      return newTask;
    } catch (err) {
      if (!(err instanceof Error && err.message.startsWith('Create task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to create task');
      }
      throw err;
    }
  }, [session, toast]);

  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status } : t)
    );

    const formattedStatus = status.replace(/_/g, ' ');

    try {
      const qs = sessionUserId ? `?userId=${encodeURIComponent(sessionUserId)}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        // Revert on failure
        await fetchTasks();
        toast.error('Failed to update task status');
        return;
      }
      toast.info(`Task status updated to ${formattedStatus}`);
    } catch {
      await fetchTasks();
      toast.error('Failed to update task status');
    }
  }, [fetchTasks, sessionUserId, toast]);

  const updateTask = useCallback(async (taskId: string, payload: Partial<CreateTaskPayload>): Promise<DBTask> => {
    // Optimistic update in state
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const updatedAssignee = payload.assigneeId
          ? users.find(u => u.id === payload.assigneeId) ?? t.assignee
          : payload.assigneeId === null || payload.assigneeId === ''
          ? null
          : t.assignee;
        return {
          ...t,
          ...payload,
          assignee: updatedAssignee,
        } as DBTask;
      })
    );

    try {
      const qs = sessionUserId ? `?userId=${encodeURIComponent(sessionUserId)}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        await fetchTasks();
        const errBody = await res.json().catch(() => ({ message: 'Update failed' }));
        const message = errBody.message || `Update task failed: ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }

      const envelope = await res.json();
      const updatedTask: DBTask = envelope?.data ?? envelope;
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...updatedTask } : t)));
      toast.success('Task details updated');
      return updatedTask;
    } catch (err) {
      console.error('[TaskContext] updateTask error:', err);
      await fetchTasks();
      if (!(err instanceof Error && err.message.startsWith('Update task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to update task');
      }
      throw err;
    }
  }, [fetchTasks, users, sessionUserId, toast]);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    // Optimistic removal from state
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      const qs = sessionUserId ? `?userId=${encodeURIComponent(sessionUserId)}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        await fetchTasks();
        const errBody = await res.json().catch(() => ({ message: 'Delete failed' }));
        const message = errBody.message || `Delete task failed: ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }
      toast.success('Task deleted successfully');
    } catch (err) {
      console.error('[TaskContext] deleteTask error:', err);
      await fetchTasks();
      if (!(err instanceof Error && err.message.startsWith('Delete task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete task');
      }
      throw err;
    }
  }, [fetchTasks, sessionUserId, toast]);

  const createSubtask = useCallback(async (taskId: string, title: string): Promise<DBSubTask> => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: 'Failed to create subtask' }));
        const msg = errBody?.error?.message || errBody.message || 'Failed to create subtask';
        toast.error(msg);
        throw new Error(msg);
      }

      const envelope = await res.json();
      const newSubtask: DBSubTask = {
        id: envelope.data.id,
        title: envelope.data.title,
        done: envelope.data.done,
      };

      setTasks(prev =>
        prev.map(t => {
          if (t.id !== taskId) return t;
          const nextSubs = [...(t.subtasks || []), newSubtask];
          return {
            ...t,
            subtasks: nextSubs,
            progress: envelope.data.taskProgress ?? t.progress,
          };
        })
      );

      toast.success('Subtask added');
      return newSubtask;
    } catch (err) {
      console.error('[TaskContext] createSubtask error:', err);
      if (!(err instanceof Error && err.message.startsWith('Failed to create subtask'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to create subtask');
      }
      throw err;
    }
  }, [toast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string, done: boolean): Promise<void> => {
    // Optimistic update
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const nextSubs = (t.subtasks || []).map(s => (s.id === subtaskId ? { ...s, done } : s));
        const doneCount = nextSubs.filter(s => s.done).length;
        const newProgress = nextSubs.length > 0 ? Math.round((doneCount / nextSubs.length) * 100) : 0;
        return {
          ...t,
          subtasks: nextSubs,
          progress: newProgress,
        };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });

      if (!res.ok) {
        await fetchTasks();
        toast.error('Failed to update subtask');
        return;
      }

      const envelope = await res.json();
      if (envelope?.data?.taskProgress !== undefined) {
        setTasks(prev =>
          prev.map(t => (t.id === taskId ? { ...t, progress: envelope.data.taskProgress } : t))
        );
      }
    } catch (err) {
      console.error('[TaskContext] toggleSubtask error:', err);
      await fetchTasks();
      toast.error('Failed to update subtask');
    }
  }, [fetchTasks, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string): Promise<void> => {
    // Optimistic removal
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const nextSubs = (t.subtasks || []).filter(s => s.id !== subtaskId);
        const doneCount = nextSubs.filter(s => s.done).length;
        const newProgress = nextSubs.length > 0 ? Math.round((doneCount / nextSubs.length) * 100) : 0;
        return {
          ...t,
          subtasks: nextSubs,
          progress: newProgress,
        };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        await fetchTasks();
        toast.error('Failed to delete subtask');
        return;
      }

      const envelope = await res.json();
      if (envelope?.data?.taskProgress !== undefined) {
        setTasks(prev =>
          prev.map(t => (t.id === taskId ? { ...t, progress: envelope.data.taskProgress } : t))
        );
      }
      toast.success('Subtask deleted');
    } catch (err) {
      console.error('[TaskContext] deleteSubtask error:', err);
      await fetchTasks();
      toast.error('Failed to delete subtask');
    }
  }, [fetchTasks, toast]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        users,
        isLoading,
        error,
        createTask,
        updateTaskStatus,
        updateTask,
        deleteTask,
        createSubtask,
        toggleSubtask,
        deleteSubtask,
        refreshTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error('useTasks must be used inside <TaskProvider>');
  }
  return ctx;
}
