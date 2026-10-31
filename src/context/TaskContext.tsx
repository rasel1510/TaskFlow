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
  projectId: string | null;
  assigneeId: string | null;
  assignee: DBUser | null;
  creatorId?: string | null;
  creator?: DBUser | null;
  project: DBProject | null;
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

  refreshTasks: () => Promise<void>;
}

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

function cleanDueDate(d: unknown): string | null {
  if (!d) return null;
  const str = String(d).trim();
  return str.includes('T') ? str.split('T')[0] : str;
}

// Module-level in-memory cache for 0ms instantaneous task/user retrieval
let cachedTasks: DBTask[] | null = null;
let cachedUsers: DBUser[] | null = null;

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const sessionUserId    = (session?.user as { id?: string })?.id;
  const sessionUserEmail = session?.user?.email ?? undefined;
  const toast = useToast();
  const [tasks, setTasks] = useState<DBTask[]>(cachedTasks || []);
  const [users, setUsers] = useState<DBUser[]>(cachedUsers || []);
  const [isLoading, setIsLoading] = useState(!cachedTasks);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (status === 'loading') return;

    try {
      const params = new URLSearchParams();
      if (sessionUserId)    params.set('userId',    sessionUserId);
      if (sessionUserEmail) params.set('userEmail', sessionUserEmail);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/tasks${qs}`, { signal });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const envelope = await res.json();
      // Handle both old raw-array and new { success, data } envelope shapes
      const rawData: DBTask[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      const data: DBTask[] = rawData.map(t => ({
        ...t,
        dueDate: cleanDueDate(t.dueDate),
      }));
      cachedTasks = data;
      setTasks(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskContext] fetchTasks error:', err);
      setError('Failed to load tasks. Please refresh.');
    }
  }, [sessionUserId, sessionUserEmail, status]);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/users', { signal });
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
      const data: DBUser[] = await res.json();
      cachedUsers = data;
      setUsers(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[TaskContext] fetchUsers error:', err);
    }
  }, []);

  // Reload whenever the session identity or auth status changes
  useEffect(() => {
    if (status === 'loading') return;
    const controller = new AbortController();
    if (!cachedTasks) setIsLoading(true);
    Promise.all([fetchTasks(controller.signal), fetchUsers(controller.signal)])
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [fetchTasks, fetchUsers, status]);

  const refreshTasks = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // ── createTask — optimistic insert with temp ID, replaced on server confirm ──
  const createTask = useCallback(async (payload: CreateTaskPayload): Promise<DBTask> => {
    const activeUserId    = (session?.user as { id?: string })?.id;
    const activeUserEmail = session?.user?.email ?? undefined;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticTask: DBTask = {
      id:               tempId,
      taskNumber:       null,
      title:            payload.title,
      description:      payload.description ?? null,
      status:           (payload.status   ?? 'todo') as DBTask['status'],
      priority:         (payload.priority ?? 'medium') as DBTask['priority'],
      dueDate:          payload.dueDate   ?? null,
      estimate:         payload.estimate  ?? null,
      labels:           payload.labels    ?? [],
      progress:         null,
      commentsCount:    0,
      attachmentsCount: 0,
      createdAt:        new Date().toISOString(),
      projectId:        payload.projectId ?? '',
      assigneeId:       activeUserId ?? payload.assigneeId ?? null,
      assignee:         null,
      project:          null,
    };

    // Instant UI — prepend temp task
    setTasks(prev => {
      const updated = [optimisticTask, ...prev];
      cachedTasks = updated;
      return updated;
    });
    const snapshot = tasks; // capture for rollback

    const finalPayload = { ...payload, assigneeId: activeUserId || payload.assigneeId };
    const params = new URLSearchParams();
    if (activeUserId)    params.set('userId',    activeUserId);
    if (activeUserEmail) params.set('userEmail', activeUserEmail);
    const qs = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await fetch(`/api/tasks${qs}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const message = errBody?.error?.message || errBody?.message || `Create task failed: ${res.status}`;
        // Rollback: remove temp task
        setTasks(prev => prev.filter(t => t.id !== tempId));
        toast.error(message);
        throw new Error(message);
      }

      const envelope = await res.json();
      const rawNewTask: DBTask = envelope?.data ?? envelope;
      const newTask: DBTask = {
        ...rawNewTask,
        dueDate: cleanDueDate(rawNewTask.dueDate),
      };

      // Replace temp entry with real server task (preserves list position)
      setTasks(prev => prev.map(t => t.id === tempId ? newTask : t));
      toast.success(`Task "${newTask.title}" created`);
      return newTask;
    } catch (err) {
      // On network error, roll back to snapshot
      setTasks(snapshot);
      if (!(err instanceof Error && err.message.startsWith('Create task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to create task');
      }
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tasks, toast]);

  // ── updateTaskStatus — already optimistic, just fix rollback to use snapshot ──
  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    const snapshot = tasks;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));

    try {
      const params = new URLSearchParams();
      if (sessionUserId)    params.set('userId',    sessionUserId);
      if (sessionUserEmail) params.set('userEmail', sessionUserEmail);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) {
        setTasks(snapshot);
        toast.error('Failed to update task status');
      }
    } catch {
      setTasks(snapshot);
      toast.error('Failed to update task status');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sessionUserId, sessionUserEmail, toast]);

  // ── updateTask — optimistic + snapshot rollback ──────────────────────────
  const updateTask = useCallback(async (taskId: string, payload: Partial<CreateTaskPayload>): Promise<DBTask> => {
    const snapshot = tasks;

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const updatedAssignee = payload.assigneeId
          ? users.find(u => u.id === payload.assigneeId) ?? t.assignee
          : payload.assigneeId === null || payload.assigneeId === ''
          ? null
          : t.assignee;
        return { ...t, ...payload, assignee: updatedAssignee } as DBTask;
      })
    );

    try {
      const params = new URLSearchParams();
      if (sessionUserId)    params.set('userId',    sessionUserId);
      if (sessionUserEmail) params.set('userEmail', sessionUserEmail);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        setTasks(snapshot);
        const errBody = await res.json().catch(() => ({ message: 'Update failed' }));
        const message = errBody.message || `Update task failed: ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }

      const envelope = await res.json();
      const rawUpdated: DBTask = envelope?.data ?? envelope;
      const updatedTask: DBTask = {
        ...rawUpdated,
        dueDate: cleanDueDate(rawUpdated.dueDate),
      };
      // Merge server response (has real assignee/project objects)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t));
      toast.success('Task updated');
      return updatedTask;
    } catch (err) {
      setTasks(snapshot);
      if (!(err instanceof Error && err.message.startsWith('Update task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to update task');
      }
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, users, sessionUserId, sessionUserEmail, toast]);

  // ── deleteTask — snapshot rollback ───────────────────────────────────────
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    const snapshot = tasks;
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      cachedTasks = updated;
      return updated;
    });

    try {
      const params = new URLSearchParams();
      if (sessionUserId)    params.set('userId',    sessionUserId);
      if (sessionUserEmail) params.set('userEmail', sessionUserEmail);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/tasks/${taskId}${qs}`, { method: 'DELETE' });

      if (!res.ok) {
        setTasks(snapshot);
        toast.error('Failed to delete task');
        throw new Error(`Delete task failed: ${res.status}`);
      }
      toast.success('Task deleted');
    } catch (err) {
      setTasks(snapshot);
      if (!(err instanceof Error && err.message.startsWith('Delete task failed'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete task');
      }
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sessionUserId, sessionUserEmail, toast]);

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

/** Alias for useTasks — use whichever name reads most clearly in context */
export const useTaskContext = useTasks;
