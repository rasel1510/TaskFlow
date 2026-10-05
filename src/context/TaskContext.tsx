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
  projectId: string | null;
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

function cleanDueDate(d: unknown): string | null {
  if (!d) return null;
  const str = String(d).trim();
  return str.includes('T') ? str.split('T')[0] : str;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const sessionUserId    = (session?.user as { id?: string })?.id;
  const sessionUserEmail = session?.user?.email ?? undefined;
  const toast = useToast();
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (status === 'loading') return;

    try {
      const params = new URLSearchParams();
      if (sessionUserId)    params.set('userId',    sessionUserId);
      if (sessionUserEmail) params.set('userEmail', sessionUserEmail);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/tasks${qs}`, { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const envelope = await res.json();
      // Handle both old raw-array and new { success, data } envelope shapes
      const rawData: DBTask[] = Array.isArray(envelope) ? envelope : (envelope?.data ?? []);
      const data: DBTask[] = rawData.map(t => ({
        ...t,
        dueDate: cleanDueDate(t.dueDate),
      }));
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
      const res = await fetch('/api/users', { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
      const data: DBUser[] = await res.json();
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
    setIsLoading(true);
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
      subtasks:         [],
    };

    // Instant UI — prepend temp task
    setTasks(prev => [optimisticTask, ...prev]);
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
    setTasks(prev => prev.filter(t => t.id !== taskId));

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

  // ── createSubtask — optimistic insert with temp ID ───────────────────────
  const createSubtask = useCallback(async (taskId: string, title: string): Promise<DBSubTask> => {
    const tempSubId = `temp_sub_${Date.now()}`;
    const optimisticSub: DBSubTask = { id: tempSubId, title, done: false };
    const snapshot = tasks;

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        return { ...t, subtasks: [...(t.subtasks || []), optimisticSub] };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title }),
      });

      if (!res.ok) {
        setTasks(snapshot);
        const errBody = await res.json().catch(() => ({ message: 'Failed to create subtask' }));
        const msg = errBody?.error?.message || errBody.message || 'Failed to create subtask';
        toast.error(msg);
        throw new Error(msg);
      }

      const envelope = await res.json();
      const realSub: DBSubTask = {
        id:    envelope.data.id,
        title: envelope.data.title,
        done:  envelope.data.done,
      };

      // Replace temp sub with real one
      setTasks(prev =>
        prev.map(t => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: (t.subtasks || []).map(s => s.id === tempSubId ? realSub : s),
            progress: envelope.data.taskProgress ?? t.progress,
          };
        })
      );

      toast.success('Subtask added');
      return realSub;
    } catch (err) {
      setTasks(snapshot);
      if (!(err instanceof Error && err.message.startsWith('Failed to create subtask'))) {
        toast.error(err instanceof Error ? err.message : 'Failed to create subtask');
      }
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, toast]);

  // ── toggleSubtask — optimistic, snapshot rollback ────────────────────────
  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string, done: boolean): Promise<void> => {
    const snapshot = tasks;

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const nextSubs = (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, done } : s);
        const doneCount = nextSubs.filter(s => s.done).length;
        const progress  = nextSubs.length > 0 ? Math.round((doneCount / nextSubs.length) * 100) : 0;
        return { ...t, subtasks: nextSubs, progress };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ done }),
      });

      if (!res.ok) {
        setTasks(snapshot);
        toast.error('Failed to update subtask');
        return;
      }

      const envelope = await res.json();
      if (envelope?.data?.taskProgress !== undefined) {
        setTasks(prev =>
          prev.map(t => t.id === taskId ? { ...t, progress: envelope.data.taskProgress } : t)
        );
      }
    } catch {
      setTasks(snapshot);
      toast.error('Failed to update subtask');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, toast]);

  // ── deleteSubtask — optimistic, snapshot rollback ────────────────────────
  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string): Promise<void> => {
    const snapshot = tasks;

    setTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const nextSubs  = (t.subtasks || []).filter(s => s.id !== subtaskId);
        const doneCount = nextSubs.filter(s => s.done).length;
        const progress  = nextSubs.length > 0 ? Math.round((doneCount / nextSubs.length) * 100) : 0;
        return { ...t, subtasks: nextSubs, progress };
      })
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });

      if (!res.ok) {
        setTasks(snapshot);
        toast.error('Failed to delete subtask');
        return;
      }

      const envelope = await res.json();
      if (envelope?.data?.taskProgress !== undefined) {
        setTasks(prev =>
          prev.map(t => t.id === taskId ? { ...t, progress: envelope.data.taskProgress } : t)
        );
      }
      toast.success('Subtask deleted');
    } catch {
      setTasks(snapshot);
      toast.error('Failed to delete subtask');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, toast]);


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

/** Alias for useTasks — use whichever name reads most clearly in context */
export const useTaskContext = useTasks;
