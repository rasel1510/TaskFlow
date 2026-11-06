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
  Terminal,
  Code2,
  ExternalLink,
  BookOpen,
  Key,
  Shield,
  Layers,
  Server,
  Zap,
  Cpu,
  ArrowRight,
  FolderGit2,
  Menu,
  X,
  FileText,
  Clock,
  Send,
  AlertCircle,
  Database,
  Hash,
  Users,
  CheckCircle2,
  Sun,
  Moon,
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
/*                           COMPREHENSIVE DATASET                            */
/* -------------------------------------------------------------------------- */

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'developing-with-flowsync',
    label: 'Developing with FlowSync',
    items: [
      { id: 'overview', label: 'Overview & Philosophy' },
      { id: 'base-urls', label: 'Base URLs & Environments' },
      { id: 'headers', label: 'HTTP Headers & Content-Type' },
      { id: 'status-codes', label: 'HTTP Status Codes' },
    ],
  },
  {
    id: 'flowsync-cli',
    label: 'FlowSync CLI',
    badge: 'v1.0',
    items: [
      { id: 'cli-install', label: 'Installation & Setup' },
      { id: 'cli-auth', label: 'CLI Authentication' },
      { id: 'cli-commands', label: 'Core Commands' },
    ],
  },
  {
    id: 'flowsync-mcp',
    label: 'FlowSync MCP',
    badge: 'AI Agents',
    items: [
      { id: 'mcp-overview', label: 'MCP Architecture (JSON-RPC)' },
      { id: 'mcp-rpc-call', label: 'tools/call (RPC)', method: 'POST' },
      { id: 'mcp-tools-catalog', label: 'Available Agent Tools' },
    ],
  },
  {
    id: 'authorization',
    label: 'Authorization',
    items: [
      { id: 'auth-tokens', label: 'Personal Access Tokens' },
      { id: 'auth-oauth', label: 'OAuth 2.0 Integration' },
      { id: 'auth-scopes', label: 'Permission Scopes' },
    ],
  },
  {
    id: 'sync',
    label: 'Sync',
    badge: 'Realtime',
    items: [
      { id: 'sync-overview', label: 'Realtime Sync Engine' },
      { id: 'sync-stream', label: 'Event Streaming (SSE)', method: 'GET' },
    ],
  },
  {
    id: 'ids',
    label: 'Ids',
    items: [
      { id: 'ids-format', label: 'Identifier Formats & CUID' },
      { id: 'ids-task-numbers', label: 'Task Numbers (TF-108)' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'workspace-members', label: 'List Team Members', method: 'GET' },
      { id: 'workspace-invite', label: 'Invite Member', method: 'POST' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    items: [
      { id: 'list-projects', label: 'List all projects', method: 'GET' },
      { id: 'create-project', label: 'Create a new project', method: 'POST' },
      { id: 'get-project', label: 'Get a project', method: 'GET' },
      { id: 'update-project', label: 'Update a project', method: 'PATCH' },
      { id: 'delete-project', label: 'Delete a project', method: 'DELETE' },
    ],
  },
  {
    id: 'colors',
    label: 'Colors',
    items: [
      { id: 'colors-palette', label: 'Color Palettes & Themes' },
    ],
  },
  {
    id: 'project-icons',
    label: 'Project icons',
    items: [
      { id: 'icons-catalog', label: 'Supported Icons & Badges' },
    ],
  },
  {
    id: 'comments',
    label: 'Comments',
    items: [
      { id: 'list-comments', label: 'Get task comments', method: 'GET' },
      { id: 'create-comment', label: 'Add comment to task', method: 'POST' },
    ],
  },
  {
    id: 'templates',
    label: 'Templates',
    items: [
      { id: 'templates-catalog', label: 'Sprint & Kanban Templates' },
    ],
  },
  {
    id: 'sections',
    label: 'Sections',
    items: [
      { id: 'list-milestones', label: 'List project milestones', method: 'GET' },
      { id: 'create-milestone', label: 'Create milestone', method: 'POST' },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    items: [
      { id: 'list-tasks', label: 'List all tasks', method: 'GET' },
      { id: 'create-task', label: 'Create a new task', method: 'POST' },
      { id: 'get-task', label: 'Get a single task', method: 'GET' },
      { id: 'update-task', label: 'Update task fields', method: 'PATCH' },
      { id: 'bulk-tasks', label: 'Bulk task operations', method: 'POST' },
      { id: 'delete-task', label: 'Delete task', method: 'DELETE' },
    ],
  },
  {
    id: 'labels',
    label: 'Labels',
    items: [
      { id: 'labels-overview', label: 'Labels & Task Tags' },
    ],
  },
  {
    id: 'folders',
    label: 'Folders',
    items: [
      { id: 'folders-overview', label: 'Project Organization' },
    ],
  },
  {
    id: 'uploads',
    label: 'Uploads',
    items: [
      { id: 'uploads-attachments', label: 'File Attachments' },
    ],
  },
  {
    id: 'filters',
    label: 'Filters',
    items: [
      { id: 'filters-search', label: 'Search Tasks & Projects', method: 'GET' },
    ],
  },
  {
    id: 'reminders',
    label: 'Reminders',
    items: [
      { id: 'reminders-notifications', label: 'Notification Preferences', method: 'GET' },
    ],
  },
  {
    id: 'location-reminders',
    label: 'Location reminders',
    items: [
      { id: 'location-reminders-geo', label: 'Geofencing Schemas' },
    ],
  },
  {
    id: 'due-dates',
    label: 'Due dates',
    items: [
      { id: 'due-dates-natural', label: 'Natural Language & Relative Dates' },
    ],
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    items: [
      { id: 'deadlines-escalation', label: 'Hard Deadlines & SLA Tracking' },
    ],
  },
  {
    id: 'user',
    label: 'User',
    items: [
      { id: 'user-session', label: 'Current User Session', method: 'GET' },
      { id: 'user-update', label: 'Update User Profile', method: 'PATCH' },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    items: [
      { id: 'activity-log', label: 'Task Audit History', method: 'GET' },
    ],
  },
  {
    id: 'backups',
    label: 'Backups',
    items: [
      { id: 'backups-export', label: 'Workspace Export & Reports', method: 'GET' },
    ],
  },
  {
    id: 'emails',
    label: 'Emails',
    items: [
      { id: 'emails-integration', label: 'Email-to-Task Ingestion' },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    items: [
      { id: 'webhooks-events', label: 'Event Payloads & Subscriptions' },
      { id: 'webhooks-signature', label: 'HMAC SHA-256 Signatures' },
    ],
  },
  {
    id: 'pagination',
    label: 'Pagination',
    items: [
      { id: 'pagination-cursor', label: 'Cursor-based Pagination' },
    ],
  },
  {
    id: 'request-limits',
    label: 'Request limits',
    items: [
      { id: 'limits-rate', label: 'Rate Limiting & 429 Handling' },
    ],
  },
  {
    id: 'url-schemes',
    label: 'Url schemes',
    items: [
      { id: 'schemes-deeplinks', label: 'flowsync:// Deep Links' },
    ],
  },
  {
    id: 'migrating-from-v9',
    label: 'Migrating from v9',
    items: [
      { id: 'migrating-v9-guide', label: 'Migration & Breaking Changes' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    items: [
      { id: 'billing-plans', label: 'Plan Tiers & Quotas' },
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
    title: 'Developing with FlowSync',
    category: 'Developing with FlowSync',
    badge: 'Guide',
    description:
      'Welcome to the FlowSync Developer Platform. FlowSync offers a fully typed REST API and an official Model Context Protocol (MCP) server for automated task tracking, team project orchestration, and AI-native workflows. All API endpoints use standard HTTP verbs, return predictable JSON envelopes, and scale with O(1) complexity bounds.',
    snippets: {
      curl: `# Test API connectivity with your live secret token\ncurl -X GET "https://flowsync.app/api/tasks?limit=1" \\\n  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';\n\n// Query the current workspace with typed responses\nconst tasks = await api.tasks.list({ limit: 1 });\nconsole.log(tasks.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks",\n    params={"limit": 1},\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 200,
      description: 'Standard FlowSync ApiResponse envelope',
      body: {
        success: true,
        data: [{ id: 'cmvvgwy7w0003tpn0pq5rip9i', taskNumber: 'TF-101', title: 'Welcome to FlowSync', status: 'done' }],
        meta: { total: 1, page: 1, limit: 1 },
      },
    },
  },

  // 2. Base URLs
  'base-urls': {
    id: 'base-urls',
    title: 'Base URLs & Environments',
    category: 'Developing with FlowSync',
    badge: 'Environments',
    description:
      'The FlowSync API is hosted on high-availability edge networks with dedicated production and local staging environments. Always send your requests over HTTPS in production.',
    snippets: {
      curl: `# Production Base URL\nhttps://flowsync.app/api\n\n# Local Development Base URL\nhttp://localhost:3000/api`,
      typescript: `// Default base URL in @/api/client.ts\nconst API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsync.app';`,
      python: `BASE_URL = "https://flowsync.app/api"`,
    },
    response: {
      status: 200,
      description: 'Environment metadata',
      body: {
        environment: 'production',
        apiVersion: 'v1.0.0',
        region: 'aws-ap-southeast-1',
        status: 'operational',
      },
    },
  },

  // 3. Headers
  headers: {
    id: 'headers',
    title: 'HTTP Headers & Content-Type',
    category: 'Developing with FlowSync',
    description:
      'All mutation requests (POST, PATCH, PUT) must include `Content-Type: application/json`. Every request requires an `Authorization` header containing your Bearer token.',
    parameters: [
      { name: 'Authorization', type: 'string', required: true, description: "Bearer token prefixed with 'Bearer '" },
      { name: 'Content-Type', type: 'string', required: true, description: 'Must be application/json for request bodies' },
      { name: 'X-Idempotency-Key', type: 'string', required: false, description: 'Optional unique UUID to prevent double task creation' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer flw_sec_live_948f..." \\\n  -H "Content-Type: application/json"`,
      typescript: `const headers = {\n  'Authorization': 'Bearer flw_sec_live_948f...',\n  'Content-Type': 'application/json'\n};`,
      python: `headers = {\n    "Authorization": "Bearer flw_sec_live_948f...",\n    "Content-Type": "application/json"\n}`,
    },
    response: {
      status: 200,
      description: 'Standard header acknowledgment',
      body: { success: true, message: 'Headers validated' },
    },
  },

  // 4. Status Codes
  'status-codes': {
    id: 'status-codes',
    title: 'HTTP Status Codes',
    category: 'Developing with FlowSync',
    description:
      'FlowSync uses conventional HTTP response codes to indicate the success or failure of an API request. Codes in the 2xx range indicate success. Codes in the 4xx range indicate an error that failed given the information provided. Codes in the 5xx range indicate an error with FlowSync servers.',
    snippets: {
      curl: `# 200 OK - Request succeeded\n# 201 Created - Resource created successfully\n# 400 Bad Request - Missing required parameters\n# 401 Unauthorized - Invalid or expired API token\n# 404 Not Found - Resource does not exist\n# 429 Too Many Requests - Rate limit exceeded (60 req/min)`,
      typescript: `if (response.status === 429) {\n  const retryAfter = response.headers.get('Retry-After');\n  console.warn(\`Rate limited. Backing off for \${retryAfter}s\`);\n}`,
      python: `if res.status_code == 429:\n    retry_after = res.headers.get("Retry-After")\n    time.sleep(int(retry_after))`,
    },
    response: {
      status: 200,
      description: 'Status summary',
      body: { success: true, code: 200, status: 'OK' },
    },
  },

  // 5. Tasks - List
  'list-tasks': {
    id: 'list-tasks',
    title: 'List all tasks',
    method: 'GET',
    path: '/api/tasks',
    category: 'Tasks',
    description:
      'Returns a paginated list of tasks in the authenticated workspace. Supports filtering by projectId, status, priority, and text search.',
    parameters: [
      { name: 'projectId', type: 'string', required: false, description: 'Filter tasks by project CUID' },
      { name: 'status', type: 'string', required: false, description: "'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'" },
      { name: 'priority', type: 'string', required: false, description: "'low' | 'medium' | 'high' | 'urgent'" },
      { name: 'search', type: 'string', required: false, description: 'Search title and description text' },
      { name: 'limit', type: 'integer', required: false, description: 'Max items per page (1-100, default 50)', default: '50' },
      { name: 'cursor', type: 'string', required: false, description: 'Cursor token for pagination' },
    ],
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/tasks?status=in_progress&priority=high&limit=10" \\\n  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';\n\nconst tasks = await api.tasks.list({\n  status: 'in_progress',\n  priority: 'high',\n  limit: 10\n});\nconsole.log(tasks.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks",\n    params={"status": "in_progress", "priority": "high", "limit": 10},\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json()["data"])`,
    },
    response: {
      status: 200,
      description: 'Tasks array with pagination metadata',
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
            assignee: { name: 'Saif Bean', email: 'saif@example.com' },
          },
        ],
        meta: { total: 1, limit: 10, nextCursor: null },
      },
    },
  },

  // 6. Tasks - Create
  'create-task': {
    id: 'create-task',
    title: 'Create a new task',
    method: 'POST',
    path: '/api/tasks',
    category: 'Tasks',
    description:
      'Creates a new task in the workspace. Automatically assigns a human-readable task number (e.g. TF-142) and triggers real-time state broadcast.',
    parameters: [],
    requestBody: {
      description: 'Task creation payload',
      fields: [
        { name: 'title', type: 'string', required: true, description: 'Task title or summary' },
        { name: 'description', type: 'string', required: false, description: 'Detailed Markdown task body' },
        { name: 'priority', type: 'string', required: false, description: "'low' | 'medium' | 'high' | 'urgent' (default: 'medium')" },
        { name: 'status', type: 'string', required: false, description: "'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'" },
        { name: 'dueDate', type: 'string', required: false, description: "Due date in YYYY-MM-DD format" },
        { name: 'projectId', type: 'string', required: false, description: 'Target project CUID' },
        { name: 'estimate', type: 'string', required: false, description: "Time estimate (e.g. '2h', '3d')" },
      ],
      example: {
        title: 'Design hero landing page',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-11-06',
        estimate: '6h',
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer flw_sec_live_948f..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "Design hero landing page",\n    "priority": "high",\n    "status": "todo",\n    "dueDate": "2026-11-06",\n    "estimate": "6h"\n  }'`,
      typescript: `import { api } from '@/api';\n\nconst newTask = await api.tasks.create({\n  title: 'Design hero landing page',\n  priority: 'high',\n  status: 'todo',\n  dueDate: '2026-11-06',\n  estimate: '6h'\n});\nconsole.log(newTask.data.id, newTask.data.taskNumber);`,
      python: `import requests\n\npayload = {\n    "title": "Design hero landing page",\n    "priority": "high",\n    "status": "todo",\n    "dueDate": "2026-11-06",\n    "estimate": "6h"\n}\nres = requests.post(\n    "https://flowsync.app/api/tasks",\n    json=payload,\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 201,
      description: 'Created task object',
      body: {
        success: true,
        data: {
          id: 'cmvvgwy7w0003tpn0pq5rip9i',
          taskNumber: 'TF-142',
          title: 'Design hero landing page',
          status: 'todo',
          priority: 'high',
          dueDate: '2026-11-06T12:00:00.000Z',
          estimate: '6h',
          createdAt: '2026-11-03T03:20:00.000Z',
        },
      },
    },
  },

  // 7. Tasks - Get
  'get-task': {
    id: 'get-task',
    title: 'Get a single task',
    method: 'GET',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Retrieves complete details of a single task by its CUID or task number.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID (e.g. cmvvgwy7w0003tpn0pq5rip9i) or task number' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';\n\nconst task = await api.tasks.get('cmvvgwy7w0003tpn0pq5rip9i');\nconsole.log(task.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json())`,
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

  // 8. Tasks - Update
  'update-task': {
    id: 'update-task',
    title: 'Update task fields',
    method: 'PATCH',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Partially updates fields of an existing task. Triggers instant optimistic update and audit history log.',
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
      curl: `curl -X PATCH https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_948f..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "status": "done"\n  }'`,
      typescript: `import { api } from '@/api';\n\nconst updated = await api.tasks.update('cmvvgwy7w0003tpn0pq5rip9i', {\n  status: 'done'\n});`,
      python: `import requests\n\nres = requests.patch(\n    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",\n    json={"status": "done"},\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 200,
      description: 'Updated task entity',
      body: {
        success: true,
        data: {
          id: 'cmvvgwy7w0003tpn0pq5rip9i',
          status: 'done',
          updatedAt: '2026-11-03T03:22:10.000Z',
        },
      },
    },
  },

  // 9. Tasks - Delete
  'delete-task': {
    id: 'delete-task',
    title: 'Delete a task',
    method: 'DELETE',
    path: '/api/tasks/:id',
    category: 'Tasks',
    description: 'Permanently deletes a task from the workspace along with its comments and activity records.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Task CUID identifier' },
    ],
    snippets: {
      curl: `curl -X DELETE https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\\n  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';\n\nawait api.tasks.delete('cmvvgwy7w0003tpn0pq5rip9i');`,
      python: `import requests\n\nrequests.delete(\n    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)`,
    },
    response: {
      status: 200,
      description: 'Deletion confirmation',
      body: { success: true, message: 'Task deleted successfully' },
    },
  },

  // 10. Projects - List
  'list-projects': {
    id: 'list-projects',
    title: 'List all projects',
    method: 'GET',
    path: '/api/projects',
    category: 'Projects',
    description: 'Returns all projects in the workspace including task counts, completion percentage, and active status.',
    parameters: [
      { name: 'search', type: 'string', required: false, description: 'Filter by project name' },
      { name: 'status', type: 'string', required: false, description: "'active' | 'archived' | 'completed'" },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects \\\n  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';\n\nconst projects = await api.projects.list();\nconsole.log(projects.data);`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/projects",\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json()["data"])`,
    },
    response: {
      status: 200,
      description: 'List of projects',
      body: {
        success: true,
        data: [
          {
            id: 'cmvrr15pf0001tppke6b9d7az',
            name: 'FlowSync Core Platform',
            description: 'Core application engine & reactive sync services',
            color: '#2563EB',
            progress: 84,
            tasksCount: 38,
            status: 'active',
          },
        ],
      },
    },
  },

  // 11. Projects - Create
  'create-project': {
    id: 'create-project',
    title: 'Create a new project',
    method: 'POST',
    path: '/api/projects',
    category: 'Projects',
    description: 'Creates a new project in the workspace with customizable branding color, description, and icon.',
    parameters: [],
    requestBody: {
      description: 'Project details',
      fields: [
        { name: 'name', type: 'string', required: true, description: 'Project name' },
        { name: 'description', type: 'string', required: false, description: 'Project summary' },
        { name: 'color', type: 'string', required: false, description: 'Hex color code (e.g. #2563EB)' },
        { name: 'icon', type: 'string', required: false, description: 'Icon identifier name' },
      ],
      example: {
        name: 'Mobile App Redesign',
        description: 'New iOS and Android release',
        color: '#10B981',
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/projects \\\n  -H "Authorization: Bearer flw_sec_live_948f..." \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Mobile App Redesign",\n    "color": "#10B981"\n  }'`,
      typescript: `import { api } from '@/api';\n\nconst newProj = await api.projects.create({\n  name: 'Mobile App Redesign',\n  color: '#10B981'\n});`,
      python: `import requests\n\nres = requests.post(\n    "https://flowsync.app/api/projects",\n    json={"name": "Mobile App Redesign", "color": "#10B981"},\n    headers={"Authorization": "Bearer flw_sec_live_948f..."}\n)\nprint(res.json())`,
    },
    response: {
      status: 201,
      description: 'Created project object',
      body: {
        success: true,
        data: {
          id: 'cmvrr15pf0002tppke6b9d7az',
          name: 'Mobile App Redesign',
          color: '#10B981',
          progress: 0,
          tasksCount: 0,
        },
      },
    },
  },

  // 12. FlowSync MCP (JSON-RPC)
  'mcp-rpc-call': {
    id: 'mcp-rpc-call',
    title: 'FlowSync MCP (JSON-RPC 2.0)',
    method: 'POST',
    path: '/api/mcp',
    category: 'FlowSync MCP',
    badge: 'AI Agents',
    description:
      'Official Model Context Protocol (MCP) endpoint. Enables LLMs (Claude Desktop, Cursor, Gemini, OpenAI agents) to query, create, update, and batch-create tasks and projects programmatically using standardized tool calls.',
    parameters: [],
    requestBody: {
      description: 'JSON-RPC 2.0 tool invocation',
      fields: [
        { name: 'jsonrpc', type: 'string', required: true, description: 'Must be "2.0"' },
        { name: 'id', type: 'number', required: true, description: 'Unique request correlation ID' },
        { name: 'method', type: 'string', required: true, description: "'tools/list' | 'tools/call' | 'resources/list'" },
        { name: 'params', type: 'object', required: false, description: 'Tool name and arguments map' },
      ],
      example: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'create_task',
          arguments: {
            title: 'Fix auth cookie rotation',
            priority: 'high',
            status: 'todo',
          },
        },
      },
    },
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "jsonrpc": "2.0",\n    "id": 1,\n    "method": "tools/call",\n    "params": {\n      "name": "create_task",\n      "arguments": {\n        "title": "Fix auth cookie rotation",\n        "priority": "high"\n      }\n    }\n  }'`,
      typescript: `const rpcResponse = await fetch('https://flowsync.app/api/mcp', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    jsonrpc: '2.0',\n    id: 1,\n    method: 'tools/call',\n    params: {\n      name: 'create_task',\n      arguments: { title: 'Fix auth cookie rotation', priority: 'high' }\n    }\n  })\n});\nconst result = await rpcResponse.json();`,
      python: `import requests\n\nres = requests.post("https://flowsync.app/api/mcp", json={\n    "jsonrpc": "2.0",\n    "id": 1,\n    "method": "tools/call",\n    "params": {\n        "name": "create_task",\n        "arguments": {"title": "Fix auth cookie rotation", "priority": "high"}\n    }\n})\nprint(res.json()["result"])`,
    },
    response: {
      status: 200,
      description: 'MCP standard JSON-RPC response',
      body: {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: 'Task #TF-143 created successfully with priority high.',
            },
          ],
        },
      },
    },
  },

  // 13. Authorization
  'auth-tokens': {
    id: 'auth-tokens',
    title: 'Personal Access Tokens',
    category: 'Authorization',
    badge: 'Security',
    description:
      'Generate personal secret API tokens in FlowSync Settings → Developers. Personal tokens start with the prefix flw_sec_live_ and carry full access permissions of your user account. Keep your API tokens secret and never commit them to client-side frontend code or public repositories.',
    snippets: {
      curl: `export FLOWSYNC_API_TOKEN="flw_sec_live_948f2bb764831"\n\ncurl -X GET https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer $FLOWSYNC_API_TOKEN"`,
      typescript: `const token = process.env.FLOWSYNC_API_TOKEN;\n\n// Send token in Authorization header\nconst res = await fetch('https://flowsync.app/api/tasks', {\n  headers: { Authorization: \`Bearer \${token}\` }\n});`,
      python: `import os, requests\n\ntoken = os.getenv("FLOWSYNC_API_TOKEN")\nres = requests.get("https://flowsync.app/api/tasks", headers={"Authorization": f"Bearer {token}"})`,
    },
    response: {
      status: 200,
      description: 'Token validation response',
      body: { success: true, authorized: true, user: 'saif@example.com' },
    },
  },

  // 14. Realtime Sync & SSE
  'sync-stream': {
    id: 'sync-stream',
    title: 'Real-time Event Streaming (SSE)',
    method: 'GET',
    path: '/api/projects/:id/messages/stream',
    category: 'Sync',
    badge: 'Live',
    description:
      'FlowSync provides a high-throughput Server-Sent Events (SSE) stream for instant real-time synchronization across connected team members, kanban cards, and live project chats.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Project CUID identifier' },
    ],
    snippets: {
      curl: `curl -N -H "Accept: text/event-stream" \\\n  -H "Authorization: Bearer flw_sec_live_948f..." \\\n  https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/messages/stream`,
      typescript: `const eventSource = new EventSource('/api/projects/cmvrr15pf0001tppke6b9d7az/messages/stream');\n\neventSource.onmessage = (event) => {\n  const payload = JSON.parse(event.data);\n  console.log('Realtime event received:', payload);\n};`,
      python: `import requests\n\nres = requests.get(\n    "https://flowsync.app/api/projects/cmvrr15pf0001tppke6b9d7az/messages/stream",\n    headers={"Accept": "text/event-stream"},\n    stream=True\n)\nfor line in res.iter_lines():\n    if line:\n        print(line.decode('utf-8'))`,
    },
    response: {
      status: 200,
      description: 'Streamed message chunks',
      body: {
        type: 'task.updated',
        data: { taskId: 'cmvvgwy7w0003tpn0pq5rip9i', status: 'done', updatedBy: 'Saif Bean' },
        timestamp: '2026-11-03T03:22:45.102Z',
      },
    },
  },

  // 15. Webhooks
  'webhooks-events': {
    id: 'webhooks-events',
    title: 'Webhooks & Event Subscriptions',
    category: 'Webhooks',
    badge: 'Push',
    description:
      'Webhooks notify your external backend or serverless functions instantly whenever events happen inside FlowSync. Supported events include task.created, task.updated, task.deleted, and project.created.',
    snippets: {
      curl: `# Example incoming webhook payload received by your server\n{\n  "event": "task.updated",\n  "createdAt": "2026-11-03T03:25:00.000Z",\n  "data": {\n    "id": "cmvvgwy7w0003tpn0pq5rip9i",\n    "taskNumber": "TF-108",\n    "status": "done"\n  }\n}`,
      typescript: `// Verify HMAC signature in Next.js / Express route\nimport crypto from 'crypto';\n\nfunction verifySignature(payload: string, signature: string, secret: string) {\n  const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');\n  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));\n}`,
      python: `import hmac, hashlib\n\ndef verify_signature(payload, signature, secret):\n    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, signature)`,
    },
    response: {
      status: 200,
      description: 'Webhook delivery format',
      body: {
        event: 'task.completed',
        timestamp: '2026-11-03T03:25:00.000Z',
        data: { id: 'cmvvgwy7w0003tpn0pq5rip9i', completedBy: 'Saif Bean' },
      },
    },
  },

  // 16. Rate Limits
  'limits-rate': {
    id: 'limits-rate',
    title: 'Rate Limits & 429 Handling',
    category: 'Request limits',
    description:
      'To ensure fair usage and zero latency degradation for millions of users, FlowSync enforces per-token rate limits. Standard tier permits 60 requests per minute, while Enterprise permits up to 1,000 requests per minute.',
    snippets: {
      curl: `# Inspect returned rate limit headers on any response\nHTTP/1.1 200 OK\nX-RateLimit-Limit: 60\nX-RateLimit-Remaining: 57\nX-RateLimit-Reset: 1793652000`,
      typescript: `// Automatic backoff example\nasync function fetchWithRetry(url: string, options: RequestInit) {\n  const res = await fetch(url, options);\n  if (res.status === 429) {\n    const retryAfter = Number(res.headers.get('Retry-After') || '2');\n    await new Promise(r => setTimeout(r, retryAfter * 1000));\n    return fetchWithRetry(url, options);\n  }\n  return res;\n}`,
      python: `import time\n# Respect Retry-After header automatically in Python requests`,
    },
    response: {
      status: 429,
      description: 'Rate limit exceeded envelope',
      body: {
        success: false,
        error: 'Too many requests. Please wait 2 seconds before retrying.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
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
    'developing-with-flowsync': true,
    tasks: true,
    projects: true,
    'flowsync-mcp': true,
    authorization: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'typescript' | 'python'>('curl');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResponse, setSimulationResponse] = useState<any>(null);
  const [simulatedStatus, setSimulatedStatus] = useState<number | null>(null);
  const [simulatedLatency, setSimulatedLatency] = useState<number | null>(null);

  // Active document data
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

  // Run interactive "Try it out" simulator
  const handleRunSimulator = () => {
    setIsSimulating(true);
    setSimulationResponse(null);

    const latency = Math.floor(Math.random() * 35) + 25; // 25-60ms realistic speed
    setTimeout(() => {
      setIsSimulating(false);
      setSimulationResponse(currentDoc.response.body);
      setSimulatedStatus(currentDoc.response.status);
      setSimulatedLatency(latency);
    }, latency + 200);
  };

  // Auto-expand section if searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {};
      NAV_SECTIONS.forEach(s => { allOpen[s.id] = true; });
      setExpandedSections(allOpen);
    }
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-600">
      
      {/* =========================================================================
          TOP NAVBAR (Developer Platform Header — Mobbin UI Standard)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          
          {/* Left brand: FlowSync Developer Platform with Official Logo */}
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

          {/* Center search shortcut indicator on larger screens */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
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

            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-black dark:hover:bg-slate-200 transition-all shadow-xs"
            >
              <span>Go to App</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN CONTAINER (Sidebar + Center Content + Right Code Sandbox)
          ========================================================================= */}
      <div className="flex-1 flex max-w-[1700px] w-full mx-auto relative">

        {/* -----------------------------------------------------------------------
            LEFT SIDEBAR (Mobbin UI Minimalist Tree)
            ----------------------------------------------------------------------- */}
        <aside
          className={`
            fixed lg:sticky top-15 z-30 h-[calc(100vh-60px)] w-72 sm:w-80 shrink-0
            bg-slate-50/70 dark:bg-[#0B0F17] border-r border-slate-200/80 dark:border-slate-800
            flex flex-col transition-all duration-300 ease-in-out
            ${mobileMenuOpen ? 'left-0 shadow-2xl' : '-left-full lg:left-0'}
          `}
        >
          {/* Search box matching Mobbin clean pattern */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Accordion Tree */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 custom-scrollbar">
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

          {/* Title & Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              {currentDoc.title}
            </h1>
            {currentDoc.badge && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60">
                {currentDoc.badge}
              </span>
            )}
          </div>

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
            RIGHT PANEL: CODE PLAYGROUND & LIVE TESTER (Mobbin / Linear Studio)
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
              <div className="flex items-center justify-between mb-2">
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

              <div className="text-[11px] text-slate-400">
                Simulates execution against FlowSync v1 API schema.
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
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
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

              <pre className="text-[11.5px] font-mono text-emerald-400/95 overflow-x-auto max-h-56 leading-snug">
                {JSON.stringify(simulationResponse || currentDoc.response.body, null, 2)}
              </pre>
            </div>

          </div>

        </aside>

      </div>

    </div>
  );
}

