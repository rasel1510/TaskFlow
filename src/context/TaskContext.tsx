'use client';




import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

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
  refreshTasks: () => Promise<void>;
}

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const sessionUserId = (session?.user as { id?: string })?.id;
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!sessionUserId) {
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`/api/tasks?userId=${encodeURIComponent(sessionUserId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const data: DBTask[] = await res.json();
      // Ensure only this user's tasks are stored in state
      setTasks(data.filter(t => t.assigneeId === sessionUserId));
      setError(null);
    } catch (err) {
      console.error('[TaskContext] fetchTasks error:', err);
      setError('Failed to load tasks. Please refresh.');
    }
  }, [sessionUserId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
      const data: DBUser[] = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('[TaskContext] fetchUsers error:', err);
    }
  }, []);

  // Initial and reactive load whenever session changes
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchTasks(), fetchUsers()]).finally(() => setIsLoading(false));
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
    const res = await fetch(`/api/tasks${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errBody.message || `Create task failed: ${res.status}`);
    }

    const newTask: DBTask = await res.json();

    // Optimistically prepend to state so it appears instantly
    setTasks(prev => [newTask, ...prev]);

    return newTask;
  }, [session]);

  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status } : t)
    );

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
      }
    } catch {
      await fetchTasks();
    }
  }, [fetchTasks, sessionUserId]);

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
        throw new Error(errBody.message || `Update task failed: ${res.status}`);
      }

      const updatedTask: DBTask = await res.json();
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...updatedTask } : t)));
      return updatedTask;
    } catch (err) {
      console.error('[TaskContext] updateTask error:', err);
      await fetchTasks();
      throw err;
    }
  }, [fetchTasks, users, sessionUserId]);

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
        throw new Error(errBody.message || `Delete task failed: ${res.status}`);
      }
    } catch (err) {
      console.error('[TaskContext] deleteTask error:', err);
      await fetchTasks();
      throw err;
    }
  }, [fetchTasks]);

  return (
    <TaskContext.Provider value={{ tasks, users, isLoading, error, createTask, updateTaskStatus, updateTask, deleteTask, refreshTasks }}>
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
