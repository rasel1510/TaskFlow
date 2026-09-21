/**
 * src/api/index.ts
 *
 * Unified API barrel export.
 *
 * Provides a single import point for all API utilities:
 *
 *   import { api, apiClient } from '@/api';
 *
 *   // Client HTTP wrapper
 *   apiClient.get(...)
 *
 *   // Domain services
 *   api.tasks.getAll(...)
 *   api.tasks.create(...)
 *   api.projects.getAll(...)
 *   api.projects.create(...)
 */

export { apiClient } from './client';
export type { ApiResponse, ApiSuccess, ApiError } from './client';

import { tasksService } from './services/tasks.service';
import { projectsService } from './services/projects.service';

export { tasksService, projectsService };

/**
 * Namespaced API object — the recommended way to access services.
 *
 * @example
 * import { api } from '@/api';
 * const result = await api.tasks.getAll({ status: 'in_progress' });
 */
export const api = {
  tasks:    tasksService,
  projects: projectsService,
} as const;
