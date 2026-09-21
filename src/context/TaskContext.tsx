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
  assigneeId?: string;
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
  refreshTasks: () => Promise<void>;
}

// -------------------------------------------------------------------------
// Context
// -------------------------------------------------------------------------

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const data: DBTask[] = await res.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      console.error('[TaskContext] fetchTasks error:', err);
      setError('Failed to load tasks. Please refresh.');
    }
  }, []);

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

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchTasks(), fetchUsers()]).finally(() => setIsLoading(false));
  }, [fetchTasks, fetchUsers]);

  const refreshTasks = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (payload: CreateTaskPayload): Promise<DBTask> => {
    // Default assigneeId to the logged-in user if not specified
    const finalPayload = {
      ...payload,
      assigneeId: payload.assigneeId || (session?.user as { id?: string })?.id || undefined,
    };

    const res = await fetch('/api/tasks', {
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
      const res = await fetch(`/api/tasks/${taskId}`, {
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
  }, [fetchTasks]);

  return (
    <TaskContext.Provider value={{ tasks, users, isLoading, error, createTask, updateTaskStatus, refreshTasks }}>
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
