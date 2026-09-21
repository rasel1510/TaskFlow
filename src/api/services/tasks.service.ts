/**
 * src/api/services/tasks.service.ts
 *
 * Client-side service layer for the Tasks API.
 *
 * All component and view code should import these functions instead of calling
 * fetch() directly. This single abstraction point makes it trivial to:
 *  - Add optimistic updates
 *  - Switch transports (REST → tRPC, GraphQL, etc.)
 *  - Mock in tests
 *
 * Usage:
 *   import { tasksService } from '@/api/services/tasks.service';
 *   const result = await tasksService.getAll({ status: 'in_progress' });
 */

import { apiClient } from '@/api/client';

// ---------------------------------------------------------------------------
// Types mirroring the API contract
// ---------------------------------------------------------------------------

export interface TaskFilters {
  status?: string;
  priority?: string;
  projectId?: string;
  assigneeId?: string;
  search?: string;
}

export interface CreateTaskPayload {
  title: string;
  projectId: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  description?: string;
  dueDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string;
  estimate?: string;
  labels?: string[];
  progress?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const tasksService = {
  /** Fetch all tasks, optionally filtered. */
  getAll(filters?: TaskFilters) {
    const params = new URLSearchParams();
    if (filters?.status)     params.set('status', filters.status);
    if (filters?.priority)   params.set('priority', filters.priority);
    if (filters?.projectId)  params.set('projectId', filters.projectId);
    if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId);
    if (filters?.search)     params.set('search', filters.search);

    const qs = params.toString();
    return apiClient.get<unknown[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },

  /** Fetch a single task by ID (includes comments and activity log). */
  getById(id: string) {
    return apiClient.get<unknown>(`/api/tasks/${id}`);
  },

  /** Create a new task. */
  create(payload: CreateTaskPayload) {
    return apiClient.post<unknown>('/api/tasks', payload);
  },

  /** Partially update a task. */
  update(id: string, payload: UpdateTaskPayload) {
    return apiClient.patch<unknown>(`/api/tasks/${id}`, payload);
  },

  /** Update just the status of a task (common operation). */
  updateStatus(id: string, status: string) {
    return apiClient.patch<unknown>(`/api/tasks/${id}`, { status });
  },

  /** Delete a task permanently. */
  delete(id: string) {
    return apiClient.delete<{ message: string }>(`/api/tasks/${id}`);
  },
};
