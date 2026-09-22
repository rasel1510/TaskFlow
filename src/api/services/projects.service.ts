

import { apiClient } from '@/api/client';

// ---------------------------------------------------------------------------
// Types mirroring the API contract
// ---------------------------------------------------------------------------

export interface CreateProjectPayload {
  name: string;
  description?: string;
  ownerId: string;
  color?: string;
  startDate?: string;
  dueDate?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const projectsService = {
  /** Fetch all projects. */
  getAll() {
    return apiClient.get<unknown[]>('/api/projects');
  },

  /** Create a new project. */
  create(payload: CreateProjectPayload) {
    return apiClient.post<unknown>('/api/projects', payload);
  },
};
