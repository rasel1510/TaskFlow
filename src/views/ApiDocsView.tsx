'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Play,
  Shield,
  Menu,
  X,
  Send,
  Home,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                               TYPE DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ParameterDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

interface EndpointDoc {
  id: string;
  title: string;
  method?: HttpMethod;
  path?: string;
  category: string;
  badge?: string;
  description: string;
  parameters?: ParameterDoc[];
  requestBody?: {
    description?: string;
    fields: ParameterDoc[];
    example: Record<string, any>;
  };
  snippets: {
    curl: string;
    typescript: string;
    python: string;
  };
  response: {
    status: number;
    description: string;
    body: Record<string, any>;
  };
}

interface NavSection {
  id: string;
  label: string;
  badge?: string;
  items: {
    id: string;
    label: string;
    method?: HttpMethod;
    badge?: string;
  }[];
}

/* -------------------------------------------------------------------------- */
/*               CANONICAL FLOWSYNC SECTIONS & ENDPOINTS                      */
/* -------------------------------------------------------------------------- */

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview & Architecture' },
      { id: 'auth-tokens', label: 'Authentication & Tokens' },
      { id: 'headers', label: 'HTTP Headers & Envelopes' },
      { id: 'status-codes', label: 'Status Codes & Errors' },
      { id: 'limits-rate', label: 'Rate Limits & Quotas' },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    items: [
      { id: 'list-tasks', label: 'List all tasks', method: 'GET' },
      { id: 'create-task', label: 'Create a task', method: 'POST' },
      { id: 'get-task', label: 'Get a task', method: 'GET' },
      { id: 'update-task', label: 'Update task', method: 'PATCH' },
      { id: 'bulk-tasks', label: 'Bulk task operations', method: 'POST' },
      { id: 'delete-task', label: 'Delete task', method: 'DELETE' },
      { id: 'task-comments', label: 'Task comments', method: 'GET' },
      { id: 'task-activities', label: 'Audit history', method: 'GET' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    items: [
      { id: 'list-projects', label: 'List all projects', method: 'GET' },
      { id: 'create-project', label: 'Create a project', method: 'POST' },
      { id: 'get-project', label: 'Get a project', method: 'GET' },
      { id: 'update-project', label: 'Update project', method: 'PATCH' },
      { id: 'delete-project', label: 'Delete project', method: 'DELETE' },
      { id: 'project-members', label: 'Project collaborators', method: 'GET' },
      { id: 'project-milestones', label: 'Project milestones', method: 'GET' },
      { id: 'project-messages', label: 'Project discussions', method: 'GET' },
      { id: 'sync-stream', label: 'Live event stream (SSE)', method: 'GET' },
    ],
  },
  {
    id: 'team',
    label: 'Team & Workspace',
    items: [
      { id: 'workspace-members', label: 'List team members', method: 'GET' },
      { id: 'workspace-invite', label: 'Invite collaborator', method: 'POST' },
      { id: 'user-profile', label: 'User profile session', method: 'GET' },
    ],
  },
  {
    id: 'search',
    label: 'Search',
    items: [
      { id: 'filters-search', label: 'Workspace instant search', method: 'GET' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    items: [
      { id: 'reports-summary', label: 'Sprint velocity & summary', method: 'GET' },
      { id: 'backups-export', label: 'Export workspace data', method: 'GET' },
    ],
  },
  {
    id: 'mcp',
    label: 'AI & Model Context Protocol',
    badge: 'MCP',
    items: [
      { id: 'mcp-overview', label: 'MCP Architecture (JSON-RPC)' },
      { id: 'mcp-rpc-call', label: 'Agent tool execution', method: 'POST' },
      { id: 'copilot-chat', label: 'Sprint Copilot AI', method: 'POST' },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    items: [
      { id: 'webhooks-events', label: 'Stripe webhook verification', method: 'POST' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*                            DOCUMENTATION CATALOG                           */
/* -------------------------------------------------------------------------- */

const DOCS_CATALOG: Record<string, EndpointDoc> = {
  // 1. Overview
  overview: {
    id: 'overview',
    title: 'Overview & Architecture',
    category: 'Getting Started',
    description:
      'FlowSync delivers an enterprise-grade project and task orchestration platform built on Next.js, Prisma, and PostgreSQL. Every endpoint returns predictable JSON envelopes, strictly enforces O(1) indexed lookups, and provides both standard REST endpoints and an official Model Context Protocol (MCP) server for Claude Desktop, Cursor, and autonomous AI agents.',
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/tasks?limit=5" \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\n// Query workspace tasks with automatic ApiResponse<T> typing\nconst tasks = await api.tasks.list({ limit: 5 });\nconsole.log(tasks.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks",\n    params={"limit": 5},\n    headers={"Authorization": "Bearer flw_sec_live_..."}\n)\nprint(res.json()["data"])`,
    },
    response: {
      status: 200,
      description: 'Standard FlowSync ApiResponse envelope',
      body: {
        success: true,
        data: [
          {
            id: 'cmvvgwy7w0003tpn0pq5rip9i',
            taskNumber: 'TF-108',
            title: 'Welcome to FlowSync Workspace',
            status: 'todo',
            priority: 'high',
          },
        ],
        meta: { total: 1, limit: 5, hasMore: false },
      },
    },
  },

  // 2. Auth Tokens
  'auth-tokens': {
    id: 'auth-tokens',
    title: 'Authentication & Tokens',
    category: 'Getting Started',
    description:
      'All FlowSync endpoints require authentication. In local browser sessions, authentication is automatically verified via secure HTTP-only cookies managed by NextAuth. For external integrations and developer CLI tools, pass your secret personal token in the Authorization header.',
    snippets: {
      curl: `export FLOWSYNC_TOKEN="flw_sec_live_948f2bb764831"\n\ncurl -X GET https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer $FLOWSYNC_TOKEN"`,
      typescript: `const token = process.env.FLOWSYNC_API_TOKEN;\n\nconst res = await fetch('https://flowsync.app/api/tasks', {\n  headers: { Authorization: \`Bearer \${token}\` }\n});\nconst payload = await res.json();`,
      python: `import os, requests\n\ntoken = os.getenv("FLOWSYNC_API_TOKEN")\nres = requests.get(\n    "https://flowsync.app/api/tasks",\n    headers={"Authorization": f"Bearer {token}"}\n)\nprint(res.json())`,
    },
    response: {
      status: 200,
      description: 'Authenticated token payload',
      body: {
        success: true,
        data: {
          authenticated: true,
          userId: 'cmvr8921a0000tp10pq9abcd',
          email: 'developer@flowsync.app',
          role: 'ADMIN',
        },
      },
    },
  },

  // 3. Headers
  headers: {
    id: 'headers',
    title: 'HTTP Headers & Envelopes',
    category: 'Getting Started',
    description:
      'All mutation requests (POST, PATCH, DELETE) require Content-Type: application/json. Every API response is strictly wrapped in the unified FlowSync ApiResponse<T> envelope containing success, data, error, and pagination meta fields.',
    parameters: [
      { name: 'Authorization', type: 'string', required: true, description: "Bearer token prefixed with 'Bearer '" },
      { name: 'Content-Type', type: 'string', required: true, description: 'Must be application/json for request payloads' },
    ],
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "Initialize sprint roadmap"}'`,
      typescript: `interface ApiResponse<T> {\n  success: boolean;\n  data?: T;\n  error?: string;\n  meta?: { limit?: number; nextCursor?: string | null; hasMore?: boolean };\n}`,
      python: `res = requests.post(\n    "https://flowsync.app/api/tasks",\n    headers={"Content-Type": "application/json"},\n    json={"title": "Initialize sprint roadmap"}\n)`,
    },
    response: {
      status: 200,
      description: 'Standard JSON response envelope',
      body: {
        success: true,
        data: { id: 'cmvvgwy7w0003tpn0pq5rip9i', title: 'Initialize sprint roadmap' },
        meta: { timestamp: '2026-11-06T18:00:00.000Z' },
      },
    },
  },

  // 4. Status Codes
  'status-codes': {
    id: 'status-codes',
    title: 'Status Codes & Errors',
    category: 'Getting Started',
    description:
      'FlowSync uses standard HTTP response codes to communicate execution outcomes. 2xx indicates success, 4xx indicates client validation or authentication errors, and 5xx indicates upstream database or server exceptions.',
    snippets: {
      curl: `# 200 OK — Request succeeded\n# 201 Created — Resource created\n# 400 Bad Request — Invalid schema or missing required fields\n# 401 Unauthorized — Missing session or invalid Bearer token\n# 404 Not Found — Resource does not exist\n# 429 Too Many Requests — Rate limit exceeded`,
      typescript: `try {\n  const res = await api.tasks.get('invalid-id');\n} catch (err) {\n  console.error('API Error:', err.message);\n}`,
      python: `res = requests.get("https://flowsync.app/api/tasks/invalid-id")\nif not res.ok:\n    print(f"Error {res.status_code}: {res.json().get('error')}")`,
    },
    response: {
      status: 404,
      description: 'Standard error envelope',
      body: {
        success: false,
        error: 'Task not found in the authenticated workspace',
        code: 'NOT_FOUND',
      },
    },
  },

  // 5. Rate Limits
  'limits-rate': {
    id: 'limits-rate',
    title: 'Rate Limits & Quotas',
    category: 'Getting Started',
    description:
      'FlowSync enforces tier-based rate limiting to maintain sub-50ms latency across multi-tenant workloads. Unauthenticated requests are limited to 20 req/min; authenticated developer tokens permit up to 120 req/min with automatic Retry-After headers.',
    snippets: {
      curl: `# Response headers indicate real-time quota status\nHTTP/1.1 200 OK\nX-RateLimit-Limit: 120\nX-RateLimit-Remaining: 114\nX-RateLimit-Reset: 1793652000`,
      typescript: `// Client-side automatic retry with backoff\nasync function fetchWithRetry(url: string, opts: RequestInit) {\n  const res = await fetch(url, opts);\n  if (res.status === 429) {\n    const retryAfter = Number(res.headers.get('Retry-After') || '2');\n    await new Promise(r => setTimeout(r, retryAfter * 1000));\n    return fetch(url, opts);\n  }\n  return res;\n}`,
      python: `import time\nres = requests.get("https://flowsync.app/api/tasks")\nif res.status_code == 429:\n    wait = int(res.headers.get("Retry-After", 2))\n    time.sleep(wait)`,
    },
    response: {
      status: 200,
      description: 'Rate limit quota status',
      body: {
        success: true,
        data: { limit: 120, remaining: 114, resetSeconds: 46 },
      },
    },
  },

  // 6. Tasks - List
  'list-tasks': {
    id: 'list-tasks',
    title: 'List all tasks',
    method: 'GET',
    path: '/api/tasks',
    category: 'Tasks',
    description:
      'Returns a paginated list of tasks in the authenticated workspace. Supports high-performance filtering by projectId, status, priority, and search keyword with cursor pagination.',
    parameters: [
      { name: 'projectId', type: 'string', required: false, description: 'Filter tasks by project CUID' },
      { name: 'status', type: 'string', required: false, description: "'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'" },
      { name: 'priority', type: 'string', required: false, description: "'low' | 'medium' | 'high' | 'urgent'" },
      { name: 'search', type: 'string', required: false, description: 'Search title and description text' },
      { name: 'limit', type: 'integer', required: false, description: 'Max items per page (1-100, default 50)', default: '50' },
      { name: 'cursor', type: 'string', required: false, description: 'Cursor token for pagination' },
    ],
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/tasks?limit=10" \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\nconst tasks = await api.tasks.list({\n  status: 'in_progress',\n  priority: 'high',\n  limit: 10\n});\nconsole.log(tasks.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks",\n    params={"status": "in_progress", "limit": 10},\n    headers={"Authorization": "Bearer flw_sec_live_..."}\n)\nprint(res.json()["data"])`,
    },
    response: {
      status: 200,
      description: 'Tasks array with cursor pagination metadata',
      body: {
        success: true,
        data: [
          {
            id: 'cmvvgwy7w0003tpn0pq5rip9i',
            taskNumber: 'TF-108',
            title: 'Implement JWT rotation cookie',
            status: 'in_progress',
            priority: 'high',
            dueDate: '2026-11-06T18:00:00.000Z',
            estimate: '4h',
            project: { id: 'cmvrr15pf0001tppke6b9d7az', name: 'Security Hardening' },
          },
        ],
        meta: { total: 1, limit: 10, nextCursor: null, hasMore: false },
      },
    },
  },

  // 7. Tasks - Create
  'create-task': {
    id: 'create-task',
    title: 'Create a task',
    method: 'POST',
    path: '/api/tasks',
    category: 'Tasks',
    description:
      'Creates a new task in the workspace. Automatically assigns a human-readable task number (e.g. TF-142), updates project progress, and records an activity audit record.',
    requestBody: {
      description: 'Task creation payload',
      fields: [
        { name: 'title', type: 'string', required: true, description: 'Task title or summary' },
        { name: 'description', type: 'string', required: false, description: 'Detailed Markdown task body' },
        { name: 'priority', type: 'string', required: false, description: "'low' | 'medium' | 'high' | 'urgent' (default: 'medium')" },
        { name: 'status', type: 'string', required: false, description: "'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'" },
        { name: 'dueDate', type: 'string', required: false, description: 'Due date in YYYY-MM-DD format' },
        { name: 'projectId', type: 'string', required: false, description: 'Target project CUID' },
        { name: 'estimate', type: 'string', required: false, description: "Time estimate (e.g. '2h', '3d')" },
      ],
      example: {
        title: 'Design API documentation page',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-11-10',
        estimate: '4h',
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "Design API documentation page",\n    "priority": "high",\n    "status": "todo"\n  }'`,
      typescript: `import { api } from '@/api';\n\nconst newTask = await api.tasks.create({\n  title: 'Design API documentation page',\n  priority: 'high',\n  status: 'todo'\n});\nconsole.log(newTask.data.taskNumber);`,
      python: `import requests\n\nres = requests.post(\n    "https://flowsync.app/api/tasks",\n    json={"title": "Design API documentation page", "priority": "high"},\n    headers={"Authorization": "Bearer flw_sec_live_..."}\n)\nprint(res.json()["data"])`,
    },
    response: {
      status: 201,
      description: 'Created task entity',
      body: {
        success: true,
        data: {
          id: 'cmvvgwy7w0003tpn0pq5rip9i',
          taskNumber: 'TF-142',
          title: 'Design API documentation page',
          status: 'todo',
          priority: 'high',
          createdAt: '2026-11-06T18:30:00.000Z',
        },
      },
    },
  },

  // 8. Tasks - Get
  'get-task': {
    id: 'get-task',
    title: 'Get a task',
    method: 'GET',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Retrieves complete details of a single task by its CUID or task number.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID or taskNumber (e.g. TF-108)' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\nconst task = await api.tasks.get('cmvvgwy7w0003tpn0pq5rip9i');\nconsole.log(task.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",\n    headers={"Authorization": "Bearer flw_sec_live_..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 200,
      description: 'Single task entity',
      body: {
        success: true,
        data: {
          id: 'cmvvgwy7w0003tpn0pq5rip9i',
          taskNumber: 'TF-108',
          title: 'Implement JWT rotation cookie',
          description: 'Ensure safe multi-tab session refreshes with atomic DB transactions.',
          status: 'in_progress',
          priority: 'high',
        },
      },
    },
  },

  // 9. Tasks - Update
  'update-task': {
    id: 'update-task',
    title: 'Update task',
    method: 'PATCH',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Partially updates fields of an existing task. Triggers optimistic UI synchronization and logs an audit record.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID identifier' },
    ],
    requestBody: {
      description: 'Fields to update',
      fields: [
        { name: 'status', type: 'string', required: false, description: "New status ('backlog' | 'todo' | 'in_progress' | 'in_review' | 'done')" },
        { name: 'priority', type: 'string', required: false, description: "New priority ('low' | 'medium' | 'high' | 'urgent')" },
        { name: 'title', type: 'string', required: false, description: 'Updated title' },
        { name: 'assigneeId', type: 'string', required: false, description: 'Reassign to member CUID' },
      ],
      example: {
        status: 'done',
        priority: 'urgent',
      },
    },
    snippets: {
      curl: `curl -X PATCH https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"status": "done"}'`,
      typescript: `import { api } from '@/api';\n\nconst updated = await api.tasks.update('cmvvgwy7w0003tpn0pq5rip9i', {\n  status: 'done'\n});`,
      python: `import requests\n\nres = requests.patch(\n    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",\n    json={"status": "done"},\n    headers={"Authorization": "Bearer flw_sec_live_..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 200,
      description: 'Updated task entity',
      body: {
        success: true,
        data: {
          id: 'cmvvgwy7w0003tpn0pq5rip9i',
          status: 'done',
          updatedAt: '2026-11-06T18:32:00.000Z',
        },
      },
    },
  },

  // 10. Tasks - Bulk
  'bulk-tasks': {
    id: 'bulk-tasks',
    title: 'Bulk task operations',
    method: 'POST',
    path: '/api/tasks/bulk',
    category: 'Tasks',
    description: 'Executes batch operations (status change, priority change, reassignment, or deletion) across up to 100 tasks in a single atomic transaction.',
    requestBody: {
      description: 'Bulk mutation payload',
      fields: [
        { name: 'taskIds', type: 'array', required: true, description: 'Array of task CUID strings' },
        { name: 'action', type: 'string', required: true, description: "'update_status' | 'update_priority' | 'delete'" },
        { name: 'value', type: 'string', required: false, description: 'New status or priority value when updating' },
      ],
      example: {
        taskIds: ['cmvvgwy7w0003tpn0pq5rip9i'],
        action: 'update_status',
        value: 'done',
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/tasks/bulk \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"taskIds": ["cmv..."], "action": "update_status", "value": "done"}'`,
      typescript: `const res = await fetch('/api/tasks/bulk', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ taskIds: ['cmv...'], action: 'update_status', value: 'done' })\n});`,
      python: `res = requests.post("https://flowsync.app/api/tasks/bulk", json={"taskIds": ["cmv..."], "action": "update_status", "value": "done"})`,
    },
    response: {
      status: 200,
      description: 'Bulk execution summary',
      body: { success: true, count: 1, message: 'Updated 1 task successfully' },
    },
  },

  // 11. Tasks - Delete
  'delete-task': {
    id: 'delete-task',
    title: 'Delete task',
    method: 'DELETE',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Permanently deletes a task from the workspace along with its associated comments and activity records.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID identifier' },
    ],
    snippets: {
      curl: `curl -X DELETE https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\nawait api.tasks.delete('cmvvgwy7w0003tpn0pq5rip9i');`,
      python: `requests.delete("https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i")`,
    },
    response: {
      status: 200,
      description: 'Deletion confirmation',
      body: { success: true, message: 'Task deleted successfully' },
    },
  },

  // 12. Tasks - Comments
  'task-comments': {
    id: 'task-comments',
    title: 'Task comments',
    method: 'GET',
    path: '/api/tasks/:id/comments',
    category: 'Tasks',
    description: 'Returns chronological discussion comments and replies attached to a specific task.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/comments \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const comments = await fetch('/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/comments');\nconst data = await comments.json();`,
      python: `res = requests.get("https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/comments")`,
    },
    response: {
      status: 200,
      description: 'Array of comments',
      body: {
        success: true,
        data: [
          {
            id: 'cmvc8901a0001tp10pq9zzzz',
            content: 'Verified cookie payload with automated tests.',
            author: { name: 'Lead Architect', email: 'architect@flowsync.app' },
            createdAt: '2026-11-06T18:34:00.000Z',
          },
        ],
      },
    },
  },

  // 13. Tasks - Activities
  'task-activities': {
    id: 'task-activities',
    title: 'Audit history',
    method: 'GET',
    path: '/api/tasks/:id/activities',
    category: 'Tasks',
    description: 'Retrieves immutable audit trail activities for compliance, status changes, assignments, and priority adjustments.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/activities \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const history = await fetch('/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/activities');\nconst log = await history.json();`,
      python: `res = requests.get("https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i/activities")`,
    },
    response: {
      status: 200,
      description: 'Audit activity entries',
      body: {
        success: true,
        data: [
          {
            id: 'cmva1234a0001tp10pq8aaaa',
            action: 'STATUS_UPDATED',
            from: 'todo',
            to: 'in_progress',
            createdAt: '2026-11-06T18:25:00.000Z',
          },
        ],
      },
    },
  },

  // 14. Projects - List
  'list-projects': {
    id: 'list-projects',
    title: 'List all projects',
    method: 'GET',
    path: '/api/projects',
    category: 'Projects',
    description: 'Returns all workspace projects including completion percentage, active task counts, and lead assignments.',
    parameters: [
      { name: 'status', type: 'string', required: false, description: "'active' | 'archived' | 'completed'" },
      { name: 'search', type: 'string', required: false, description: 'Filter projects by title' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\nconst projects = await api.projects.list();\nconsole.log(projects.data);`,
      python: `import requests\n\nres = requests.get("https://flowsync.app/api/projects")\nprint(res.json()["data"])`,
    },
    response: {
      status: 200,
      description: 'List of projects in workspace',
      body: {
        success: true,
        data: [
          {
            id: 'cmvrr15pf0001tppke6b9d7az',
            name: 'FlowSync Core Platform',
            description: 'Core application engine and reactive sync services',
            color: '#2563EB',
            progress: 84,
            tasksCount: 38,
            status: 'active',
          },
        ],
      },
    },
  },

  // 15. Projects - Create
  'create-project': {
    id: 'create-project',
    title: 'Create a project',
    method: 'POST',
    path: '/api/projects',
    category: 'Projects',
    description: 'Creates a new workspace project with custom color branding, milestone tracking, and task lists.',
    requestBody: {
      description: 'Project payload',
      fields: [
        { name: 'name', type: 'string', required: true, description: 'Project name' },
        { name: 'description', type: 'string', required: false, description: 'Project summary' },
        { name: 'color', type: 'string', required: false, description: 'Hex color string (e.g. #2563EB)' },
      ],
      example: {
        name: 'Mobile Client v2',
        description: 'Native iOS & Android offline workspace',
        color: '#10B981',
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/projects \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Mobile Client v2", "color": "#10B981"}'`,
      typescript: `import { api } from '@/api';\n\nconst proj = await api.projects.create({\n  name: 'Mobile Client v2',\n  color: '#10B981'\n});`,
      python: `res = requests.post("https://flowsync.app/api/projects", json={"name": "Mobile Client v2", "color": "#10B981"})`,
    },
    response: {
      status: 201,
      description: 'Created project object',
      body: {
        success: true,
        data: {
          id: 'cmvrr15pf0002tppke6b9d7az',
          name: 'Mobile Client v2',
          color: '#10B981',
          progress: 0,
          tasksCount: 0,
        },
      },
    },
  },

  // 16. Projects - Get
  'get-project': {
    id: 'get-project',
    title: 'Get a project',
    method: 'GET',
    path: '/api/projects/:id',
    category: 'Projects',
    description: 'Retrieves complete project details, including milestone count, assigned collaborators, and task breakdown.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `import { api } from '@/api';\n\nconst project = await api.projects.get('cmvrr15pf0001tppke6b9d7az');`,
      python: `res = requests.get("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az")`,
    },
    response: {
      status: 200,
      description: 'Project details',
      body: {
        success: true,
        data: {
          id: 'cmvrr15pf0001tppke6b9d7az',
          name: 'FlowSync Core Platform',
          color: '#2563EB',
          progress: 84,
          tasksCount: 38,
        },
      },
    },
  },

  // 17. Projects - Update
  'update-project': {
    id: 'update-project',
    title: 'Update project',
    method: 'PATCH',
    path: '/api/projects/:id',
    category: 'Projects',
    description: 'Modifies an existing project name, description, color, or archived status.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    requestBody: {
      description: 'Fields to update',
      fields: [
        { name: 'name', type: 'string', required: false, description: 'New project name' },
        { name: 'description', type: 'string', required: false, description: 'Updated summary' },
        { name: 'color', type: 'string', required: false, description: 'New hex color' },
      ],
      example: { color: '#6366F1' },
    },
    snippets: {
      curl: `curl -X PATCH https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"color": "#6366F1"}'`,
      typescript: `await api.projects.update('cmvrr15pf0001tppke6b9d7az', { color: '#6366F1' });`,
      python: `requests.patch("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az", json={"color": "#6366F1"})`,
    },
    response: {
      status: 200,
      description: 'Updated project entity',
      body: { success: true, data: { id: 'cmvrr15pf0001tppke6b9d7az', color: '#6366F1' } },
    },
  },

  // 18. Projects - Delete
  'delete-project': {
    id: 'delete-project',
    title: 'Delete project',
    method: 'DELETE',
    path: '/api/projects/:id',
    category: 'Projects',
    description: 'Permanently deletes a project and cascades cleanup to linked tasks and milestones.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -X DELETE https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `await api.projects.delete('cmvrr15pf0001tppke6b9d7az');`,
      python: `requests.delete("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az")`,
    },
    response: {
      status: 200,
      description: 'Deletion confirmation',
      body: { success: true, message: 'Project deleted successfully' },
    },
  },

  // 19. Projects - Collaborators
  'project-members': {
    id: 'project-members',
    title: 'Project collaborators',
    method: 'GET',
    path: '/api/projects/:id/members',
    category: 'Projects',
    description: 'Lists team members assigned to collaborate on this project.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/members \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const members = await fetch('/api/projects/cmvrr15pf0001tppke6b9d7az/members');\nconst data = await members.json();`,
      python: `res = requests.get("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/members")`,
    },
    response: {
      status: 200,
      description: 'List of project collaborators',
      body: {
        success: true,
        data: [
          { id: 'cmvr8921a0000tp10pq9abcd', name: 'Saif Bean', email: 'saif@flowsync.app', role: 'ADMIN' },
        ],
      },
    },
  },

  // 20. Projects - Milestones
  'project-milestones': {
    id: 'project-milestones',
    title: 'Project milestones',
    method: 'GET',
    path: '/api/projects/:id/milestones',
    category: 'Projects',
    description: 'Retrieves all roadmap milestones, deadline dates, and completion status for a project.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/milestones \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const milestones = await fetch('/api/projects/cmvrr15pf0001tppke6b9d7az/milestones');`,
      python: `res = requests.get("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/milestones")`,
    },
    response: {
      status: 200,
      description: 'Milestones array',
      body: {
        success: true,
        data: [
          { id: 'cmvm1001a0000tp10pq9xxxx', title: 'Beta Release v1.0', targetDate: '2026-11-15', completed: true },
        ],
      },
    },
  },

  // 21. Projects - Discussions
  'project-messages': {
    id: 'project-messages',
    title: 'Project discussions',
    method: 'GET',
    path: '/api/projects/:id/messages',
    category: 'Projects',
    description: 'Retrieves team chat messages and discussions within a project.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/messages \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const chat = await fetch('/api/projects/cmvrr15pf0001tppke6b9d7az/messages');`,
      python: `res = requests.get("https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/messages")`,
    },
    response: {
      status: 200,
      description: 'Recent discussions',
      body: {
        success: true,
        data: [
          { id: 'cmvmsg01a0000tp10pq9yyyy', sender: 'Saif', message: 'Sprint demo deployment succeeded.' },
        ],
      },
    },
  },

  // 22. Projects - SSE Real-time Stream
  'sync-stream': {
    id: 'sync-stream',
    title: 'Live event stream (SSE)',
    method: 'GET',
    path: '/api/projects/:id/messages/stream',
    category: 'Projects',
    description:
      'High-throughput Server-Sent Events (SSE) connection streaming real-time status changes, new comments, and live message broadcasts to connected web clients.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -N -H "Accept: text/event-stream" \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/messages/stream`,
      typescript: `const sse = new EventSource('/api/projects/cmvrr15pf0001tppke6b9d7az/messages/stream');\nsse.onmessage = (e) => console.log('Live event:', JSON.parse(e.data));`,
      python: `import requests\nres = requests.get("https://flowsync.app/api/projects/.../stream", stream=True)`,
    },
    response: {
      status: 200,
      description: 'Server-Sent Event packet',
      body: {
        type: 'task.updated',
        data: { taskId: 'cmvvgwy7w0003tpn0pq5rip9i', status: 'done' },
        timestamp: '2026-11-06T18:40:00.000Z',
      },
    },
  },

  // 23. Team - Members
  'workspace-members': {
    id: 'workspace-members',
    title: 'List team members',
    method: 'GET',
    path: '/api/team/members',
    category: 'Team & Workspace',
    description: 'Lists all registered users in the organization with their assigned roles (ADMIN, MEMBER, VIEWER).',
    parameters: [],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/team/members \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const team = await fetch('/api/team/members');\nconst data = await team.json();`,
      python: `res = requests.get("https://flowsync.app/api/team/members")`,
    },
    response: {
      status: 200,
      description: 'Team member roster',
      body: {
        success: true,
        data: [
          { id: 'cmvr8921a0000tp10pq9abcd', name: 'Saif Bean', email: 'saif@flowsync.app', role: 'ADMIN' },
        ],
      },
    },
  },

  // 24. Team - Invite
  'workspace-invite': {
    id: 'workspace-invite',
    title: 'Invite collaborator',
    method: 'POST',
    path: '/api/team/invite',
    category: 'Team & Workspace',
    description: 'Sends an email invitation with an onboarding link for a new member to join the workspace.',
    requestBody: {
      description: 'Invitation payload',
      fields: [
        { name: 'email', type: 'string', required: true, description: 'Collaborator email address' },
        { name: 'role', type: 'string', required: false, description: "'ADMIN' | 'MEMBER' | 'VIEWER' (default: 'MEMBER')" },
      ],
      example: { email: 'teammate@company.com', role: 'MEMBER' },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/team/invite \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "teammate@company.com", "role": "MEMBER"}'`,
      typescript: `const res = await fetch('/api/team/invite', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ email: 'teammate@company.com' })\n});`,
      python: `res = requests.post("https://flowsync.app/api/team/invite", json={"email": "teammate@company.com"})`,
    },
    response: {
      status: 200,
      description: 'Invitation confirmation',
      body: { success: true, message: 'Invitation sent to teammate@company.com' },
    },
  },

  // 25. User Profile
  'user-profile': {
    id: 'user-profile',
    title: 'User profile session',
    method: 'GET',
    path: '/api/users',
    category: 'Team & Workspace',
    description: 'Retrieves current user identity, organization affiliation, and permissions.',
    parameters: [],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/users \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const user = await fetch('/api/users');\nconst profile = await user.json();`,
      python: `res = requests.get("https://flowsync.app/api/users")`,
    },
    response: {
      status: 200,
      description: 'User profile entity',
      body: {
        success: true,
        data: { id: 'cmvr8921a0000tp10pq9abcd', email: 'saif@flowsync.app', name: 'Saif' },
      },
    },
  },

  // 26. Search
  'filters-search': {
    id: 'filters-search',
    title: 'Workspace instant search',
    method: 'GET',
    path: '/api/search',
    category: 'Search',
    description: 'Executes indexed full-text search across all tasks (titles, descriptions, taskNumbers) and projects.',
    parameters: [
      { name: 'q', type: 'string', required: true, description: 'Search keyword query' },
    ],
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/search?q=auth" \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const res = await fetch('/api/search?q=auth');\nconst matches = await res.json();`,
      python: `res = requests.get("https://flowsync.app/api/search", params={"q": "auth"})`,
    },
    response: {
      status: 200,
      description: 'Search results map',
      body: {
        success: true,
        data: {
          tasks: [{ id: 'cmvvgwy7w0003tpn0pq5rip9i', taskNumber: 'TF-108', title: 'Implement JWT rotation cookie' }],
          projects: [{ id: 'cmvrr15pf0001tppke6b9d7az', name: 'FlowSync Core Platform' }],
        },
      },
    },
  },

  // 27. Reports - Summary
  'reports-summary': {
    id: 'reports-summary',
    title: 'Sprint velocity & summary',
    method: 'GET',
    path: '/api/reports/summary',
    category: 'Reports & Analytics',
    description: 'Returns real-time sprint analytics: completion rate, throughput, lead/cycle time in days, and overdue task count.',
    parameters: [],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/reports/summary \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const metrics = await fetch('/api/reports/summary');\nconst summary = await metrics.json();`,
      python: `res = requests.get("https://flowsync.app/api/reports/summary")`,
    },
    response: {
      status: 200,
      description: 'Velocity analytics snapshot',
      body: {
        success: true,
        data: {
          totalTasks: 38,
          completedTasks: 32,
          completionRate: 84.2,
          leadTimeDays: 3.2,
          cycleTimeDays: 1.8,
          throughputPerWeek: 14,
        },
      },
    },
  },

  // 28. Reports - Export
  'backups-export': {
    id: 'backups-export',
    title: 'Export workspace data',
    method: 'GET',
    path: '/api/reports/export',
    category: 'Reports & Analytics',
    description: 'Exports workspace tasks, projects, and milestone metrics as clean structured CSV or JSON backup files.',
    parameters: [
      { name: 'format', type: 'string', required: false, description: "'json' | 'csv' (default: 'json')", default: 'json' },
    ],
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/reports/export?format=json" \\\n  -H "Authorization: Bearer flw_sec_live_..."`,
      typescript: `const exportRes = await fetch('/api/reports/export?format=json');`,
      python: `res = requests.get("https://flowsync.app/api/reports/export")`,
    },
    response: {
      status: 200,
      description: 'Export metadata',
      body: {
        success: true,
        data: { exportedAt: '2026-11-06T18:45:00.000Z', totalRecords: 38 },
      },
    },
  },

  // 29. MCP Overview
  'mcp-overview': {
    id: 'mcp-overview',
    title: 'MCP Architecture (JSON-RPC)',
    category: 'AI & Model Context Protocol',
    description:
      'FlowSync natively implements Anthropic’s Model Context Protocol (MCP). AI assistants such as Claude Desktop and Cursor can directly query and orchestrate tasks, create sprints, and retrieve project status without custom glue code.',
    snippets: {
      curl: `# Test MCP server heartbeat\ncurl -X GET https://flowsync.app/api/mcp`,
      typescript: `// Claude Desktop configuration in claude_desktop_config.json:\n{\n  "mcpServers": {\n    "flowsync": {\n      "command": "npx",\n      "args": ["-y", "flowsync-mcp@latest"]\n    }\n  }\n}`,
      python: `# Connect to FlowSync via standard SSE or HTTP JSON-RPC transport`,
    },
    response: {
      status: 200,
      description: 'MCP Server Capabilities',
      body: {
        status: 'online',
        protocol: 'model-context-protocol',
        version: '1.0.0',
        capabilities: ['tools', 'resources', 'prompts'],
        endpoint: '/api/mcp',
      },
    },
  },

  // 30. MCP RPC Call
  'mcp-rpc-call': {
    id: 'mcp-rpc-call',
    title: 'Agent tool execution',
    method: 'POST',
    path: '/api/mcp',
    category: 'AI & Model Context Protocol',
    description:
      'Executes registered agent tools (create_task, list_tasks, update_task, batch_create_tasks, list_projects, get_workspace_summary) using standardized JSON-RPC 2.0 specification.',
    requestBody: {
      description: 'JSON-RPC 2.0 tool invocation',
      fields: [
        { name: 'jsonrpc', type: 'string', required: true, description: 'Must be "2.0"' },
        { name: 'id', type: 'number', required: true, description: 'Request correlation identifier' },
        { name: 'method', type: 'string', required: true, description: "'tools/list' | 'tools/call'" },
        { name: 'params', type: 'object', required: false, description: 'Tool arguments map' },
      ],
      example: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'`,
      typescript: `const rpcRes = await fetch('https://flowsync.app/api/mcp', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })\n});`,
      python: `res = requests.post("https://flowsync.app/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})`,
    },
    response: {
      status: 200,
      description: 'MCP tool response',
      body: {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            { name: 'create_task', description: 'Creates a new task in the workspace' },
            { name: 'list_tasks', description: 'Query tasks with filters' },
            { name: 'update_task', description: 'Update task status or priority' },
            { name: 'get_workspace_summary', description: 'Retrieve analytics snapshot' },
          ],
        },
      },
    },
  },

  // 31. AI Copilot
  'copilot-chat': {
    id: 'copilot-chat',
    title: 'Sprint Copilot AI',
    method: 'POST',
    path: '/api/copilot',
    category: 'AI & Model Context Protocol',
    description: 'Interactive AI Copilot streaming assistance for roadmap planning, task estimation, and retrospective analysis.',
    requestBody: {
      description: 'Copilot query payload',
      fields: [
        { name: 'message', type: 'string', required: true, description: 'Natural language instruction' },
      ],
      example: { message: 'Summarize overdue tasks in current sprint' },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/copilot \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Summarize overdue tasks"}'`,
      typescript: `const res = await fetch('/api/copilot', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ message: 'Summarize overdue tasks' })\n});`,
      python: `res = requests.post("https://flowsync.app/api/copilot", json={"message": "Summarize overdue tasks"})`,
    },
    response: {
      status: 200,
      description: 'Copilot AI response',
      body: {
        success: true,
        data: { reply: 'Currently 2 tasks are overdue. Recommend reallocating TF-108 to next sprint.' },
      },
    },
  },

  // 32. Webhooks
  'webhooks-events': {
    id: 'webhooks-events',
    title: 'Stripe webhook verification',
    method: 'POST',
    path: '/api/webhooks/stripe',
    category: 'Webhooks',
    description: 'Receives and cryptographically verifies Stripe invoice and payment intent events to immediately provision Pro licenses.',
    parameters: [
      { name: 'stripe-signature', type: 'string', required: true, description: 'HMAC signature header generated by Stripe' },
    ],
    snippets: {
      curl: `# Stripe CLI webhook forwarding command\nstripe listen --forward-to localhost:3000/api/webhooks/stripe`,
      typescript: `// Verified with official stripe.webhooks.constructEvent(payload, sig, secret)`,
      python: `# Verified with stripe.Webhook.construct_event(payload, sig, secret)`,
    },
    response: {
      status: 200,
      description: 'Webhook acknowledgment',
      body: { received: true },
    },
  },
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

export default function ApiDocsView() {
  const [selectedDocId, setSelectedDocId] = useState<string>('list-tasks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'getting-started': true,
    tasks: true,
    projects: true,
    team: true,
    search: true,
    reports: true,
    mcp: true,
    webhooks: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'typescript' | 'python'>('curl');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResponse, setSimulationResponse] = useState<any>(null);
  const [simulatedStatus, setSimulatedStatus] = useState<number | null>(null);
  const [simulatedLatency, setSimulatedLatency] = useState<number | null>(null);

  // Active document data (fallback gracefully to list-tasks if not found)
  const currentDoc: EndpointDoc = DOCS_CATALOG[selectedDocId] || DOCS_CATALOG['list-tasks'];

  // Toggle nav section accordion
  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return NAV_SECTIONS;
    const query = searchQuery.toLowerCase();

    return NAV_SECTIONS.map(section => {
      const matchSectionLabel = section.label.toLowerCase().includes(query);
      const filteredItems = section.items.filter(
        item => item.label.toLowerCase().includes(query) || (item.method && item.method.toLowerCase().includes(query))
      );

      if (matchSectionLabel || filteredItems.length > 0) {
        return {
          ...section,
          items: filteredItems.length > 0 ? filteredItems : section.items,
        };
      }
      return null;
    }).filter(Boolean) as NavSection[];
  }, [searchQuery]);

  // Copy code handler
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Run interactive "Test Call" against real FlowSync endpoint
  const handleRunSimulator = async () => {
    setIsSimulating(true);
    setSimulationResponse(null);
    setSimulatedStatus(null);
    setSimulatedLatency(null);

    const startTime = performance.now();
    try {
      if (currentDoc.method && currentDoc.path) {
        let fetchUrl = currentDoc.path;

        // Substitute placeholder route parameters with real demo IDs if needed
        if (fetchUrl.includes(':id')) {
          fetchUrl = fetchUrl.replace(':id', 'demo-id');
        }

        const fetchOptions: RequestInit = {
          method: currentDoc.method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (currentDoc.method === 'POST' || currentDoc.method === 'PATCH') {
          if (currentDoc.requestBody?.example) {
            fetchOptions.body = JSON.stringify(currentDoc.requestBody.example);
          } else if (currentDoc.id === 'mcp-rpc-call') {
            fetchOptions.body = JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/list',
              params: {},
            });
          }
        }

        const res = await fetch(fetchUrl, fetchOptions);
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        let data: any;
        try {
          data = await res.json();
        } catch {
          data = { statusText: res.statusText };
        }

        setSimulatedStatus(res.status);
        setSimulatedLatency(latency);
        setSimulationResponse(data);
      } else {
        // Informational doc (e.g. guide/overview)
        const endTime = performance.now();
        setSimulatedStatus(200);
        setSimulatedLatency(Math.max(12, Math.round(endTime - startTime)));
        setSimulationResponse(currentDoc.response.body);
      }
    } catch {
      // In case of offline or network interruption, return realistic schema response
      const endTime = performance.now();
      setSimulatedStatus(currentDoc.response.status);
      setSimulatedLatency(Math.max(18, Math.round(endTime - startTime)));
      setSimulationResponse(currentDoc.response.body);
    } finally {
      setIsSimulating(false);
    }
  };

  // Auto-expand section if searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {};
      NAV_SECTIONS.forEach(s => { allOpen[s.id] = true; });
      setExpandedSections(allOpen);
    }
  }, [searchQuery]);

  // Reset simulator state when switching doc tabs
  useEffect(() => {
    setSimulationResponse(null);
    setSimulatedStatus(null);
    setSimulatedLatency(null);
  }, [selectedDocId]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-600">
      
      {/* =========================================================================
          TOP NAVBAR (Developer Platform Header — Mobbin UI Standard)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          
          {/* Left brand: FlowSync with Official Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link href="/" aria-label="FlowSync Home" className="flex items-center gap-2.5 group">
              {/* FlowSync Brand Logo — Exact from Landing Page */}
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs group-hover:scale-105 transition-transform duration-200">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50">
                  <title>FlowSync Logo</title>
                  <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                  <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                  <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                </svg>
              </div>

              <span className="font-bold text-lg text-slate-950 dark:text-white tracking-tight">
                FlowSync
              </span>
            </Link>
          </div>

          {/* Center search input */}
          <div className="flex items-center flex-1 max-w-md mx-2 sm:mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search API reference, endpoints, schemas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-xl text-xs bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right action links */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Landing</span>
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN CONTAINER (Sidebar + Center Content + Right Code Sandbox)
          ========================================================================= */}
      <div className="flex-1 flex max-w-[1700px] w-full mx-auto relative">

        {/* -----------------------------------------------------------------------
            LEFT SIDEBAR (Noise-Free, Clean Hierarchy)
            ----------------------------------------------------------------------- */}
        <aside
          className={`
            fixed lg:sticky top-15 z-30 h-[calc(100vh-60px)] w-72 sm:w-80 shrink-0
            bg-slate-50/70 dark:bg-[#0B0F17] border-r border-slate-200/80 dark:border-slate-800
            flex flex-col transition-all duration-300 ease-in-out
            ${mobileMenuOpen ? 'left-0 shadow-2xl' : '-left-full lg:left-0'}
          `}
        >
          {/* Navigation Accordion Tree */}
          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5 custom-scrollbar">
            {filteredSections.map(section => {
              const isExpanded = expandedSections[section.id];
              const hasItems = section.items && section.items.length > 0;

              return (
                <div key={section.id} className="select-none">
                  {/* Category Header with right chevron */}
                  <div
                    onClick={() => {
                      if (hasItems) {
                        toggleSection(section.id);
                      }
                      if (section.items[0]) {
                        setSelectedDocId(section.items[0].id);
                      }
                    }}
                    className={`
                      group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors
                      ${
                        section.items.some(i => i.id === selectedDocId)
                          ? 'bg-slate-200/60 dark:bg-slate-800/80 text-slate-950 dark:text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{section.label}</span>
                      {section.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {section.badge}
                        </span>
                      )}
                    </div>

                    {hasItems && (
                      <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform">
                        {isExpanded ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Sub-items / Endpoints List */}
                  {isExpanded && hasItems && (
                    <div className="mt-0.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 py-1">
                      {section.items.map(item => {
                        const isSelected = selectedDocId === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedDocId(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`
                              w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer
                              ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/50 dark:text-blue-400'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                              }
                            `}
                          >
                            <span className="truncate">{item.label}</span>

                            {item.method && (
                              <span
                                className={`
                                  ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0
                                  ${
                                    item.method === 'GET'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                                      : item.method === 'POST'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                      : item.method === 'PATCH'
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                  }
                                `}
                              >
                                {item.method}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer with Official FlowSync Brand Icon */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" fill="currentColor" viewBox="0 0 50 50">
              <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
              <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
              <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
            </svg>
            <span>Powered by <strong>FlowSync Platform</strong></span>
          </div>
        </aside>

        {/* -----------------------------------------------------------------------
            CENTER DOCUMENTATION AREA (Linear/Mobbin Standard)
            ----------------------------------------------------------------------- */}
        <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 xl:pr-6 max-w-4xl">
          
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-400 mb-3 uppercase tracking-wider">
            <span>{currentDoc.category}</span>
            <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{currentDoc.title}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            {currentDoc.title}
          </h1>

          {/* Description */}
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {currentDoc.description}
          </p>

          {/* Endpoint Route Card (if HTTP method defined) */}
          {currentDoc.method && currentDoc.path && (
            <div className="mt-6 p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span
                  className={`
                    px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider
                    ${
                      currentDoc.method === 'GET'
                        ? 'bg-blue-600 text-white'
                        : currentDoc.method === 'POST'
                        ? 'bg-emerald-600 text-white'
                        : currentDoc.method === 'PATCH'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                    }
                  `}
                >
                  {currentDoc.method}
                </span>

                <code className="text-xs sm:text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {currentDoc.path}
                </code>
              </div>

              <button
                onClick={() => handleCopyCode(`https://flowsync.app${currentDoc.path}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy URL</span>
              </button>
            </div>
          )}

          {/* Authentication Section */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Authentication</span>
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Pass your personal API token in the <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">Authorization</code> request header.
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="truncate mr-2">Authorization: Bearer flw_sec_live_948f2bb764831...</span>
              <button
                onClick={() => handleCopyCode('Authorization: Bearer flw_sec_live_948f2bb764831...')}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy Authorization header"
              >
                <Copy size={13} />
              </button>
            </div>
          </div>

          {/* Parameters Table (Query / Path) */}
          {currentDoc.parameters && currentDoc.parameters.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">
                Request Parameters
              </h2>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Parameter</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                    {currentDoc.parameters.map(param => (
                      <tr key={param.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {param.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {param.type}
                        </td>
                        <td className="py-3 px-4">
                          {param.required ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                              REQUIRED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              OPTIONAL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {param.description}
                          {param.default && (
                            <span className="block mt-0.5 text-slate-400">
                              Default: <code className="font-mono">{param.default}</code>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body JSON Schema (if POST / PATCH) */}
          {currentDoc.requestBody && (
            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">
                Request Body
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {currentDoc.requestBody.description || 'JSON object payload in application/json format.'}
              </p>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Field</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Required</th>
                      <th className="py-2.5 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {currentDoc.requestBody.fields.map(field => (
                      <tr key={field.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {field.name}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {field.type}
                        </td>
                        <td className="py-3 px-4">
                          {field.required ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                              REQUIRED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              OPTIONAL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {field.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Response Definitions */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">
              Responses
            </h2>
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {currentDoc.response.status}
                </span>
                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  {currentDoc.response.description}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">application/json</span>
            </div>
          </div>

          {/* Collapsible Mobile Code Preview if screen is small */}
          <div className="lg:hidden mt-8">
            <div className="p-4 rounded-2xl bg-[#0B0F17] text-white border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Example Code</span>
                <button
                  onClick={() => handleCopyCode(currentDoc.snippets[activeCodeLang])}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-200 overflow-x-auto p-3 rounded-xl bg-slate-950 border border-slate-800">
                {currentDoc.snippets[activeCodeLang]}
              </pre>
            </div>
          </div>

        </main>

        {/* -----------------------------------------------------------------------
            RIGHT PANEL: LIVE PLAYGROUND (Connected to Real Local Endpoints)
            ----------------------------------------------------------------------- */}
        <aside className="hidden lg:block w-96 xl:w-[460px] shrink-0 sticky top-15 h-[calc(100vh-60px)] p-6 pl-2 overflow-y-auto custom-scrollbar">
          
          <div className="rounded-2xl bg-[#0B0F17] border border-slate-800 text-slate-100 shadow-xl overflow-hidden flex flex-col">
            
            {/* Header: Language Switcher Tabs */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/90 flex items-center justify-between">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/80 text-xs font-medium border border-slate-800/70">
                {(['curl', 'typescript', 'python'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setActiveCodeLang(lang)}
                    className={`
                      px-2.5 py-1 rounded-md transition-all text-xs font-semibold cursor-pointer
                      ${
                        activeCodeLang === lang
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }
                    `}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'typescript' ? 'TypeScript' : 'Python'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleCopyCode(currentDoc.snippets[activeCodeLang])}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy code snippet"
              >
                {copiedCode ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Block Snippet */}
            <div className="p-4 bg-[#080B11] overflow-x-auto max-h-72">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed">
                <code>{currentDoc.snippets[activeCodeLang]}</code>
              </pre>
            </div>

            {/* Interactive Runner ("Try It Out") */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={13} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Interactive Playground
                  </span>
                </div>

                <button
                  onClick={handleRunSimulator}
                  disabled={isSimulating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all shadow-sm shadow-blue-600/30 active:scale-95 cursor-pointer"
                >
                  {isSimulating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Test Call</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Response Preview Box */}
            <div className="p-4 bg-[#080B11] border-t border-slate-800/80 flex-1 min-h-[180px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Response (JSON)
                </span>

                <div className="flex items-center gap-2">
                  {simulatedStatus && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      simulatedStatus >= 200 && simulatedStatus < 300
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : simulatedStatus === 401 || simulatedStatus === 403
                        ? 'bg-amber-950 text-amber-400 border-amber-800'
                        : 'bg-rose-950 text-rose-400 border-rose-800'
                    }`}>
                      HTTP {simulatedStatus}
                    </span>
                  )}
                  {simulatedLatency && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {simulatedLatency}ms
                    </span>
                  )}
                </div>
              </div>

              <pre className="text-[11.5px] font-mono text-emerald-400/95 overflow-x-auto max-h-64 leading-snug">
                {JSON.stringify(simulationResponse || currentDoc.response.body, null, 2)}
              </pre>
            </div>

          </div>

        </aside>

      </div>

    </div>
  );
}
