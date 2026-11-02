'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Terminal,
  Code2,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Server,
  Braces,
  Key,
  Play,
  Send,
} from 'lucide-react';

interface ToolDoc {
  name: string;
  description: string;
  params: string;
}

const MCP_TOOLS: ToolDoc[] = [
  {
    name: 'create_task',
    description: 'Create a new task in FlowSync with title, due date, priority, and project.',
    params: 'title (req), dueDate, priority, status, description, projectName',
  },
  {
    name: 'list_tasks',
    description: 'Query tasks in the workspace with optional filters (project, status, priority, overdue).',
    params: 'status, priority, projectName, search, isOverdue, limit',
  },
  {
    name: 'update_task',
    description: 'Update the status, priority, title, due date, or project of an existing task.',
    params: 'taskId (req), status, priority, title, dueDate, description',
  },
  {
    name: 'batch_create_tasks',
    description: 'Create multiple tasks in one call. Ideal for decomposing a sprint backlog.',
    params: 'tasks: [{ title (req), priority, dueDate, status, projectName }]',
  },
  {
    name: 'list_projects',
    description: 'List all active projects in FlowSync with health, progress, and metadata.',
    params: 'search',
  },
  {
    name: 'get_workspace_summary',
    description: 'Executive summary: total tasks, status breakdown, overdue items, and velocity.',
    params: '(none)',
  },
];

type ApiLanguage = 'curl' | 'typescript' | 'python';

interface ApiEndpointDoc {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  description: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
  snippets: Record<ApiLanguage, string>;
  response: string;
}

const API_ENDPOINTS: ApiEndpointDoc[] = [
  {
    id: 'create-task',
    method: 'POST',
    path: '/api/tasks',
    title: 'Create Task',
    description: 'Creates a new task in the workspace. Automatically assigns task number and logs audit activity.',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Task title or summary' },
      { name: 'priority', type: 'string', required: false, description: "'low' | 'medium' | 'high' | 'urgent' (default: 'medium')" },
      { name: 'status', type: 'string', required: false, description: "'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'" },
      { name: 'dueDate', type: 'string', required: false, description: "Due date in 'YYYY-MM-DD' format or natural relative date" },
      { name: 'projectId', type: 'string', required: false, description: 'Target project ID' },
      { name: 'estimate', type: 'string', required: false, description: "Time estimate (e.g. '4h', '2d')" },
    ],
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/tasks \\
  -H "Authorization: Bearer flw_sec_live_948f..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Design hero landing page",
    "priority": "high",
    "status": "todo",
    "dueDate": "2026-11-06",
    "estimate": "6h"
  }'`,
      typescript: `import { api } from '@/api';

const newTask = await api.tasks.create({
  title: 'Design hero landing page',
  priority: 'high',
  status: 'todo',
  dueDate: '2026-11-06',
  estimate: '6h',
});

console.log(newTask.data.id, newTask.data.taskNumber);`,
      python: `import requests

url = "https://flowsync.app/api/tasks"
headers = {
    "Authorization": "Bearer flw_sec_live_948f...",
    "Content-Type": "application/json"
}
payload = {
    "title": "Design hero landing page",
    "priority": "high",
    "status": "todo",
    "dueDate": "2026-11-06"
}

res = requests.post(url, json=payload, headers=headers)
print(res.json())`,
    },
    response: `{
  "success": true,
  "data": {
    "id": "cmvvgwy7w0003tpn0pq5rip9i",
    "taskNumber": "TF-142",
    "title": "Design hero landing page",
    "status": "todo",
    "priority": "high",
    "dueDate": "2026-11-06T12:00:00.000Z",
    "estimate": "6h",
    "createdAt": "2026-11-01T03:30:00.000Z"
  }
}`,
  },
  {
    id: 'list-tasks',
    method: 'GET',
    path: '/api/tasks',
    title: 'List Tasks',
    description: 'Query tasks with cursor-based pagination, project scope, status filtering, and search.',
    parameters: [
      { name: 'projectId', type: 'string', required: false, description: 'Filter tasks by project' },
      { name: 'status', type: 'string', required: false, description: 'Filter by task status' },
      { name: 'priority', type: 'string', required: false, description: 'Filter by task priority' },
      { name: 'search', type: 'string', required: false, description: 'Search title and description' },
      { name: 'limit', type: 'number', required: false, description: 'Max items to return (1-100, default: 50)' },
    ],
    snippets: {
      curl: `curl -X GET "https://flowsync.app/api/tasks?status=in_progress&priority=high" \\
  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';

const tasks = await api.tasks.list({
  status: 'in_progress',
  priority: 'high',
});

console.log(tasks.data);`,
      python: `import requests

res = requests.get(
    "https://flowsync.app/api/tasks",
    params={"status": "in_progress", "priority": "high"},
    headers={"Authorization": "Bearer flw_sec_live_948f..."}
)
print(res.json()["data"])`,
    },
    response: `{
  "success": true,
  "data": [
    {
      "id": "cmvvgwy7w0003tpn0pq5rip9i",
      "taskNumber": "TF-108",
      "title": "Implement JWT rotation cookie",
      "status": "in_progress",
      "priority": "high",
      "assignee": { "name": "Saif Bean", "email": "saif@example.com" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50 }
}`,
  },
  {
    id: 'update-task',
    method: 'PATCH',
    path: '/api/tasks/:id',
    title: 'Update Task',
    description: 'Update specific fields of an existing task. Triggers status listeners and notifications.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'Unique task identifier' },
      { name: 'status', type: 'string', required: false, description: 'New status' },
      { name: 'priority', type: 'string', required: false, description: 'New priority level' },
      { name: 'assigneeId', type: 'string', required: false, description: 'Reassign to user ID' },
    ],
    snippets: {
      curl: `curl -X PATCH https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i \\
  -H "Authorization: Bearer flw_sec_live_948f..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "done"
  }'`,
      typescript: `import { api } from '@/api';

const updated = await api.tasks.update('cmvvgwy7w0003tpn0pq5rip9i', {
  status: 'done',
});`,
      python: `import requests

res = requests.patch(
    "https://flowsync.app/api/tasks/cmvvgwy7w0003tpn0pq5rip9i",
    json={"status": "done"},
    headers={"Authorization": "Bearer flw_sec_live_948f..."}
)
print(res.json())`,
    },
    response: `{
  "success": true,
  "data": {
    "id": "cmvvgwy7w0003tpn0pq5rip9i",
    "status": "done",
    "updatedAt": "2026-11-01T03:32:10.000Z"
  }
}`,
  },
  {
    id: 'list-projects',
    method: 'GET',
    path: '/api/projects',
    title: 'List Projects',
    description: 'Fetch projects within the workspace including progress % and task counts.',
    parameters: [
      { name: 'search', type: 'string', required: false, description: 'Filter by project name' },
    ],
    snippets: {
      curl: `curl -X GET https://flowsync.app/api/projects \\
  -H "Authorization: Bearer flw_sec_live_948f..."`,
      typescript: `import { api } from '@/api';

const projects = await api.projects.list();
console.log(projects.data);`,
      python: `import requests

res = requests.get(
    "https://flowsync.app/api/projects",
    headers={"Authorization": "Bearer flw_sec_live_948f..."}
)
print(res.json()["data"])`,
    },
    response: `{
  "success": true,
  "data": [
    {
      "id": "cmvrr15pf0001tppke6b9d7az",
      "name": "FlowSync Web App",
      "status": "active",
      "progress": 68,
      "tasksCount": 24
    }
  ]
}`,
  },
  {
    id: 'mcp-rpc',
    method: 'POST',
    path: '/api/mcp',
    title: 'MCP JSON-RPC 2.0',
    description: 'Model Context Protocol standard endpoint for direct tool calling by AI agents.',
    parameters: [
      { name: 'method', type: 'string', required: true, description: "'tools/list' | 'tools/call' | 'resources/list'" },
      { name: 'params', type: 'object', required: false, description: 'Tool call arguments or parameters' },
    ],
    snippets: {
      curl: `curl -X POST https://flowsync.app/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": {
        "title": "Fix staging auth cookie",
        "priority": "high",
        "status": "todo"
      }
    }
  }'`,
      typescript: `const rpcResponse = await fetch('https://flowsync.app/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'create_task',
      arguments: { title: 'Fix staging auth cookie', priority: 'high' }
    }
  })
});

const result = await rpcResponse.json();`,
      python: `import requests

res = requests.post("https://flowsync.app/api/mcp", json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "create_task",
        "arguments": {"title": "Fix staging auth cookie", "priority": "high"}
    }
})
print(res.json()["result"])`,
    },
    response: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Task #TF-143 created successfully with priority high."
      }
    ]
  }
}`,
  },
];

export default function DeveloperPlatformSection() {
  // Left Side (MCP) states
  const [mcpTab, setMcpTab] = useState<'chatgpt' | 'claude' | 'cursor'>('chatgpt');
  const [selectedTool, setSelectedTool] = useState<string>('create_task');
  const [copiedMcp, setCopiedMcp] = useState(false);

  // Right Side (API) states
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('create-task');
  const [apiLanguage, setApiLanguage] = useState<ApiLanguage>('curl');
  const [copiedApi, setCopiedApi] = useState(false);

  const activeEndpoint = API_ENDPOINTS.find(e => e.id === selectedEndpointId) || API_ENDPOINTS[0];

  const mcpConfigs = {
    chatgpt: {
      title: 'ChatGPT Custom GPT / Action',
      badge: 'OpenAI GPTs',
      description: 'Connect FlowSync to ChatGPT so your team can ask ChatGPT to create tasks, inspect sprint health, or update tasks in plain English.',
      endpoint: 'https://flowsync.app/api/mcp',
      snippet: `// In ChatGPT GPT Builder -> Actions -> Add Action:
// URL: https://flowsync.app/api/mcp
// Protocol: Model Context Protocol / JSON-RPC 2.0
{
  "name": "FlowSync_MCP",
  "description": "Autonomous task and sprint management tool engine for FlowSync.",
  "endpoint": "https://flowsync.app/api/mcp",
  "capabilities": ["create_task", "list_tasks", "update_task", "batch_create_tasks", "list_projects", "get_workspace_summary"]
}`,
    },
    claude: {
      title: 'Claude Desktop Integration',
      badge: 'Anthropic Claude',
      description: 'Add FlowSync to your Claude Desktop configuration file to give Claude native tools inside your local workspace.',
      endpoint: 'claude_desktop_config.json',
      snippet: `{
  "mcpServers": {
    "flowsync": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch", "https://flowsync.app/api/mcp"],
      "env": {
        "FLOWSYNC_API_KEY": "flw_sec_live_your_key_here"
      }
    }
  }
}`,
    },
    cursor: {
      title: 'Cursor IDE & AI Agents',
      badge: 'Cursor / Windsurf',
      description: 'Let your IDE agent create subtasks and check blockers while writing code.',
      endpoint: '.cursor/mcp.json',
      snippet: `{
  "mcpServers": {
    "flowsync-tools": {
      "url": "https://flowsync.app/api/mcp",
      "type": "http"
    }
  }
}`,
    },
  };

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpConfigs[mcpTab].snippet);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  const handleCopyApi = () => {
    navigator.clipboard.writeText(activeEndpoint.snippets[apiLanguage]);
    setCopiedApi(true);
    setTimeout(() => setCopiedApi(false), 2000);
  };

  const methodBadgeColors: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    POST: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    PATCH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
  };

  return (
    <section id="developer-platform" className="relative w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
            Developer Platform & AI Engine
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-neutral-950 dark:text-white leading-[1.15]">
          Built for Developers & Autonomous AI
        </h2>
        <p className="mt-3.5 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
          Talk to FlowSync directly inside ChatGPT via Model Context Protocol (MCP) on the left, or integrate your software using our production REST API and documentation on the right.
        </p>
      </div>

      {/* 2-Column Split: Left = MCP in ChatGPT, Right = REST API & Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-8 items-start">
        
        {/* =========================================================================
            LEFT COLUMN: MODEL CONTEXT PROTOCOL (MCP) & CHATGPT
            ========================================================================= */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0e1013] shadow-xl overflow-hidden">
          {/* Card Top Banner */}
          <div className="px-4 sm:px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  Model Context Protocol (MCP)
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Live
                  </span>
                </h3>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                  Native integration with ChatGPT, Claude & Cursor
                </p>
              </div>
            </div>

            {/* Target Client Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 text-xs self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setMcpTab('chatgpt')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  mcpTab === 'chatgpt'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                ChatGPT
              </button>
              <button
                type="button"
                onClick={() => setMcpTab('claude')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  mcpTab === 'claude'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setMcpTab('cursor')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  mcpTab === 'cursor'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Cursor
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Interactive Live ChatGPT Simulation UI */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  Live Experience in ChatGPT
                </span>
                <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                  JSON-RPC 2.0 @ /api/mcp
                </span>
              </div>

              {/* Mock Chat Window */}
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#14161a] p-3.5 sm:p-4 space-y-3.5 text-xs">
                {/* User Prompt */}
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    U
                  </div>
                  <div className="flex-1 bg-white dark:bg-neutral-800/70 p-2.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xs">
                    <p className="text-neutral-800 dark:text-neutral-200">
                      "Check high-priority tasks in FlowSync and create a task for Saif to test the MCP endpoint before Friday."
                    </p>
                  </div>
                </div>

                {/* ChatGPT MCP Tool Execution Call */}
                <div className="pl-8 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-mono">
                    <Terminal className="h-3 w-3" />
                    <span>Executing MCP tool: <strong className="font-semibold">flowsync.create_task</strong></span>
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 pl-1">
                    payload: &#123; title: "Test MCP endpoint", priority: "high", dueDate: "2026-11-06" &#125;
                  </div>
                </div>

                {/* ChatGPT Response */}
                <div className="flex items-start gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 shadow-xs">
                    GPT
                  </div>
                  <div className="flex-1 bg-white dark:bg-neutral-800/70 p-2.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xs space-y-1">
                    <p className="text-neutral-800 dark:text-neutral-200">
                      Done! I created task <strong className="text-neutral-950 dark:text-white font-semibold">#TF-142: Test MCP endpoint</strong> assigned to Saif Bean with <span className="text-amber-600 dark:text-amber-400 font-medium">High priority</span>, due Friday, Nov 6.
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> FlowSync Synced
                      </span>
                      <span>•</span>
                      <span>Kanban Updated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MCP Setup Configuration Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                    {mcpConfigs[mcpTab].title}
                  </h4>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                    {mcpConfigs[mcpTab].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMcp}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Copy configuration snippet"
                >
                  {copiedMcp ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span className="text-[11px]">Copy Config</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Box */}
              <div className="relative rounded-xl border border-neutral-800/80 bg-neutral-950 dark:bg-black p-3.5 overflow-x-auto text-[11.5px] font-mono text-neutral-300 shadow-inner">
                <pre className="leading-relaxed">
                  <code>{mcpConfigs[mcpTab].snippet}</code>
                </pre>
              </div>
            </div>

            {/* MCP Tools Catalog */}
            <div className="space-y-2.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  6 Built-In MCP Tools
                </span>
                <span className="text-[11px] text-neutral-400">
                  Standard JSON Schema
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MCP_TOOLS.map((tool) => {
                  const isSelected = selectedTool === tool.name;
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => setSelectedTool(tool.name)}
                      className={`text-left p-2 rounded-lg border transition-all text-xs cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-neutral-950 dark:text-white shadow-xs'
                          : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="font-mono font-semibold text-[11px] truncate text-emerald-600 dark:text-emerald-400">
                        {tool.name}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {tool.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Tool Details */}
              {selectedTool && (
                <div className="p-2.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/50 text-[11px]">
                  {(() => {
                    const item = MCP_TOOLS.find((t) => t.name === selectedTool);
                    if (!item) return null;
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-neutral-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            Available in ChatGPT
                          </span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300 text-[11px]">
                          {item.description}
                        </p>
                        <div className="font-mono text-[10.5px] text-neutral-500 dark:text-neutral-400 truncate">
                          Params: {item.params}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: REST API & DEVELOPER DOCUMENTATION
            ========================================================================= */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0e1013] shadow-xl overflow-hidden">
          {/* Card Top Banner */}
          <div className="px-4 sm:px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Code2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  REST API & SDK Documentation
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">
                    v1.0
                  </span>
                </h3>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                  Full programmatic integration for external developers
                </p>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/80 text-xs self-start sm:self-auto overflow-x-auto max-w-full">
              {(['curl', 'typescript', 'python'] as ApiLanguage[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setApiLanguage(lang)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    apiLanguage === lang
                      ? 'bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'curl' ? 'cURL' : lang === 'typescript' ? 'TypeScript' : 'Python'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Horizontal Endpoint Selector Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Select API Endpoint</span>
                <span className="font-mono text-[11px]">Base: https://flowsync.app/api</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {API_ENDPOINTS.map((endpoint) => {
                  const isSelected = selectedEndpointId === endpoint.id;
                  return (
                    <button
                      key={endpoint.id}
                      type="button"
                      onClick={() => setSelectedEndpointId(endpoint.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-neutral-950 dark:text-white shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${methodBadgeColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <span className="font-medium text-[11.5px]">{endpoint.path}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Endpoint Overview & Auth Header */}
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#14161a] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${methodBadgeColors[activeEndpoint.method]}`}>
                    {activeEndpoint.method}
                  </span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white text-xs">
                    {activeEndpoint.path}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                  <Key className="h-3 w-3 text-neutral-400" />
                  Bearer Token / Session Cookie
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-[12px] leading-relaxed">
                {activeEndpoint.description}
              </p>
            </div>

            {/* Request Code Snippet with Copy Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-blue-500" />
                  Request Example ({apiLanguage.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={handleCopyApi}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Copy request code"
                >
                  {copiedApi ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span className="text-[11px]">Copy Request</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-neutral-800/80 bg-neutral-950 dark:bg-black p-3.5 overflow-x-auto text-[11.5px] font-mono text-neutral-300 shadow-inner">
                <pre className="leading-relaxed">
                  <code>{activeEndpoint.snippets[apiLanguage]}</code>
                </pre>
              </div>
            </div>

            {/* Response Envelope Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Braces className="h-3.5 w-3.5 text-emerald-500" />
                  Standard ApiResponse&lt;T&gt; (200 OK / 201 Created)
                </span>
                <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  &#123; success, data, error, meta &#125;
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800/80 bg-neutral-950 dark:bg-black p-3.5 overflow-x-auto text-[11px] font-mono text-emerald-400 shadow-inner max-h-48 overflow-y-auto">
                <pre className="leading-relaxed">
                  <code>{activeEndpoint.response}</code>
                </pre>
              </div>
            </div>

            {/* Parameters Table */}
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                Parameters & Payload Schema
              </span>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <div className="min-w-[420px]">
                    <div className="grid grid-cols-12 bg-neutral-100/70 dark:bg-neutral-800/50 px-3 py-2 font-semibold text-[11px] text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="col-span-4 font-mono">Field</div>
                  <div className="col-span-3 font-mono">Type</div>
                  <div className="col-span-5">Description</div>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-[#111317]">
                  {activeEndpoint.parameters.map((param) => (
                    <div key={param.name} className="grid grid-cols-12 px-3 py-2 items-center text-[11px]">
                      <div className="col-span-4 font-mono font-medium text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <span>{param.name}</span>
                        {param.required && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-sans font-semibold">
                            req
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 font-mono text-neutral-500 dark:text-neutral-400">
                        {param.type}
                      </div>
                      <div className="col-span-5 text-neutral-600 dark:text-neutral-300">
                        {param.description}
                      </div>
                    </div>
                  ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Integration Footer Pill */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 text-xs text-neutral-600 dark:text-neutral-400 shadow-xs">
          <Server className="h-4 w-4 text-neutral-500" />
          <span>Need custom webhooks or enterprise rate limits?</span>
          <Link
            href="/auth/login"
            className="font-semibold text-neutral-950 dark:text-white hover:underline inline-flex items-center gap-1"
          >
            Get API Token <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
