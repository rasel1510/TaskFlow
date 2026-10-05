/**
 * src/lib/mcp/tools.ts
 *
 * Canonical Model Context Protocol (MCP) tool registry for FlowSync.
 * Implements tool declarations (JSON Schema) and high-performance execution handlers.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { McpToolDefinition, McpToolCallResult } from './types';
import { logActivity } from '@/lib/activity';
import { recomputeProjectProgress } from '@/lib/projectProgress';

// ---------------------------------------------------------------------------
// Date Helper for Natural Language Dates
// ---------------------------------------------------------------------------

export function parseNaturalDate(input: unknown): Date | undefined {
  if (!input || typeof input !== 'string') return undefined;
  let str = input.trim();
  if (str.includes('T')) {
    str = str.split('T')[0].trim();
  }
  const lower = str.toLowerCase();
  const now = new Date();

  if (lower === 'today') {
    const d = new Date(now);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  if (lower === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  // "in X days"
  const inDaysMatch = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  // Weekday matching: "next monday", "monday", "friday"
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    const name = weekdays[i];
    if (lower === name || lower === `next ${name}`) {
      const currentDay = now.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      d.setUTCHours(12, 0, 0, 0);
      return d;
    }
  }

  // Standard date parsing strictly YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    if (!isNaN(d.getTime()) && year >= 2000 && year <= 2100) {
      return d;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    if (year >= 2000 && year <= 2100) {
      return parsed;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Tool Definitions (MCP Standard JSON Schema)
// ---------------------------------------------------------------------------

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'create_task',
    description: 'Create a new task in FlowSync with title, due date, priority, project, and optional subtasks.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The task title (e.g. "Deploy auth service", "Refactor navbar")',
        },
        dueDate: {
          type: 'string',
          description: 'Due date strictly in YYYY-MM-DD format (e.g. "2026-09-05") or relative ("tomorrow", "next monday", "in 3 days"). Never add time or timezone strings like T00:00:00.000Z.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Priority level (default: medium)',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
          description: 'Initial task status (default: todo)',
        },
        description: {
          type: 'string',
          description: 'Detailed description or acceptance criteria',
        },
        projectName: {
          type: 'string',
          description: 'Name of the project to associate with (e.g. "Website Redesign", "Mobile App")',
        },
        projectId: {
          type: 'string',
          description: 'Exact project ID if known',
        },
        estimate: {
          type: 'string',
          description: 'Time or story point estimate (e.g. "2h", "1d", "3pts")',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags/labels for the task (e.g. ["frontend", "bug"])',
        },
        subtasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of checklist subtask titles to create under this task',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Query tasks in the workspace with optional filters (project, status, priority, overdue, search).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
          description: 'Filter by status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Filter by priority',
        },
        projectName: {
          type: 'string',
          description: 'Filter tasks belonging to a specific project name',
        },
        search: {
          type: 'string',
          description: 'Search string matching task title or description',
        },
        isOverdue: {
          type: 'boolean',
          description: 'If true, only returns tasks that are past their due date and not marked done',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tasks to return (default: 20, max: 50)',
        },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Update the status, priority, title, due date, or project of an existing task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID or task number (e.g. "TF-004")',
        },
        title: {
          type: 'string',
          description: 'Updated title',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
          description: 'New status for the task',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'New priority',
        },
        dueDate: {
          type: 'string',
          description: 'New due date strictly formatted as "YYYY-MM-DD" (e.g. "2026-09-05") or relative terms ("tomorrow", "in 3 days"). Never add timestamps like T00:00:00.000Z.',
        },
        description: {
          type: 'string',
          description: 'Updated description',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'batch_create_tasks',
    description: 'Create multiple tasks in one call. Ideal for decomposing a feature or sprint into multiple tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              dueDate: { type: 'string', description: 'Due date strictly in YYYY-MM-DD format (e.g. "2026-09-05") or relative' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'] },
              description: { type: 'string' },
              projectName: { type: 'string' },
              subtasks: { type: 'array', items: { type: 'string' } },
            },
            required: ['title'],
          },
          description: 'Array of task specifications to create',
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'add_subtasks',
    description: 'Add checklist subtasks to an existing task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID or task number (e.g. "TF-001")',
        },
        subtaskTitles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of subtask titles to create',
        },
      },
      required: ['taskId', 'subtaskTitles'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all active projects in FlowSync with progress, health, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional filter by project name',
        },
      },
    },
  },
  {
    name: 'get_workspace_summary',
    description: 'Retrieve an executive summary of the workspace: total tasks, status breakdown, overdue items, and upcoming deadlines.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Execution Handlers
// ---------------------------------------------------------------------------

export interface ExecutionContext {
  userId?: string;
  userEmail?: string;
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ExecutionContext = {}
): Promise<McpToolCallResult> {
  try {
    switch (toolName) {
      case 'create_task':
        return await handleCreateTask(args, context);
      case 'list_tasks':
        return await handleListTasks(args, context);
      case 'update_task':
        return await handleUpdateTask(args, context);
      case 'batch_create_tasks':
        return await handleBatchCreateTasks(args, context);
      case 'add_subtasks':
        return await handleAddSubtasks(args, context);
      case 'list_projects':
        return await handleListProjects(args, context);
      case 'get_workspace_summary':
        return await handleGetWorkspaceSummary(context);
      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown tool execution error';
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool error in ${toolName}: ${msg}` }],
    };
  }
}

// ---------------------------------------------------------------------------
// Tool Handler Implementations
// ---------------------------------------------------------------------------

async function resolveUser(context: ExecutionContext) {
  if (context.userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: context.userEmail.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    });
    if (user) return user;
  }
  if (context.userId) {
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { id: true, name: true, email: true },
    });
    if (user) return user;
  }
  // Fallback to first user in system if available
  return await prisma.user.findFirst({
    select: { id: true, name: true, email: true },
  });
}

async function handleCreateTask(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const title = String(args.title || '').trim();
  if (!title) {
    return { isError: true, content: [{ type: 'text', text: 'Task title is required.' }] };
  }

  const user = await resolveUser(context);
  const assigneeId = user?.id || null;

  // Resolve project if specified
  let targetProjectId: string | null = null;
  let targetProjectName: string | undefined;

  if (args.projectId && typeof args.projectId === 'string') {
    const p = await prisma.project.findUnique({
      where: { id: args.projectId },
      select: { id: true, name: true },
    });
    if (p) {
      targetProjectId = p.id;
      targetProjectName = p.name;
    }
  } else if (args.projectName && typeof args.projectName === 'string') {
    const p = await prisma.project.findFirst({
      where: { name: { contains: args.projectName.trim(), mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (p) {
      targetProjectId = p.id;
      targetProjectName = p.name;
    }
  }

  // Parse natural due date
  const parsedDueDate = parseNaturalDate(args.dueDate);

  // Validate status and priority
  const allowedStatuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
  const statusStr = typeof args.status === 'string' ? args.status.toLowerCase() : 'todo';
  const status = (allowedStatuses.includes(statusStr) ? statusStr : 'todo') as Prisma.TaskCreateInput['status'];

  const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
  const priorityStr = typeof args.priority === 'string' ? args.priority.toLowerCase() : 'medium';
  const priority = (allowedPriorities.includes(priorityStr) ? priorityStr : 'medium') as Prisma.TaskCreateInput['priority'];

  // Auto-generate taskNumber TF-XXX
  const taskCount = await prisma.task.count();
  const taskNumber = `TF-${String(taskCount + 1).padStart(3, '0')}`;

  const subtasksList = Array.isArray(args.subtasks)
    ? (args.subtasks as unknown[]).map(s => String(s).trim()).filter(Boolean)
    : [];

  const createdTask = await prisma.task.create({
    data: {
      taskNumber,
      title,
      description: typeof args.description === 'string' ? args.description.trim() : null,
      status,
      priority,
      dueDate: parsedDueDate,
      estimate: typeof args.estimate === 'string' ? args.estimate.trim() : null,
      labels: Array.isArray(args.labels) ? (args.labels as string[]) : [],
      projectId: targetProjectId,
      assigneeId,
      subtasks: subtasksList.length > 0 ? {
        create: subtasksList.map(t => ({ title: t, done: false })),
      } : undefined,
    },
    include: {
      project: { select: { id: true, name: true, color: true } },
      subtasks: true,
    },
  });

  try {
    await logActivity(createdTask.id, 'Task created via FlowSync MCP Agent', '🤖');
    if (targetProjectId) {
      await recomputeProjectProgress(targetProjectId);
    }
  } catch {}

  const resultObj = {
    id: createdTask.id,
    taskNumber: createdTask.taskNumber,
    title: createdTask.title,
    status: createdTask.status,
    priority: createdTask.priority,
    dueDate: createdTask.dueDate?.toISOString().split('T')[0] || null,
    projectName: createdTask.project?.name || targetProjectName || 'Personal',
    subtasksCount: createdTask.subtasks.length,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Task created successfully: [${createdTask.taskNumber}] "${createdTask.title}" (Status: ${createdTask.status}, Priority: ${createdTask.priority}${createdTask.dueDate ? `, Due: ${createdTask.dueDate.toISOString().split('T')[0]}` : ''})`,
        data: resultObj,
      },
    ],
  };
}

async function handleListTasks(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const where: Prisma.TaskWhereInput = {};

  if (args.status && typeof args.status === 'string') {
    where.status = args.status.toLowerCase() as Prisma.TaskWhereInput['status'];
  }

  if (args.priority && typeof args.priority === 'string') {
    where.priority = args.priority.toLowerCase() as Prisma.TaskWhereInput['priority'];
  }

  if (args.projectName && typeof args.projectName === 'string') {
    where.project = {
      name: { contains: args.projectName.trim(), mode: 'insensitive' },
    };
  }

  if (args.search && typeof args.search === 'string') {
    where.OR = [
      { title: { contains: args.search.trim(), mode: 'insensitive' } },
      { description: { contains: args.search.trim(), mode: 'insensitive' } },
    ];
  }

  if (args.isOverdue === true) {
    where.dueDate = { lt: new Date() };
    where.status = { not: 'done' };
  }

  const limit = Math.min(50, Math.max(1, typeof args.limit === 'number' ? args.limit : 20));

  const tasks = await prisma.task.findMany({
    where,
    take: limit,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      taskNumber: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      labels: true,
      project: { select: { id: true, name: true, color: true } },
      subtasks: { select: { id: true, title: true, done: true } },
    },
  });

  const formatted = tasks.map(t => ({
    id: t.id,
    taskNumber: t.taskNumber,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    projectName: t.project?.name || null,
    subtasks: t.subtasks.map(s => `${s.done ? '[x]' : '[ ]'} ${s.title}`),
  }));

  return {
    content: [
      {
        type: 'text',
        text: `Found ${tasks.length} task(s):\n${formatted
          .map(t => `- [${t.taskNumber || 'TASK'}] ${t.title} (${t.status} | ${t.priority}${t.dueDate ? ` | due ${t.dueDate}` : ''}${t.projectName ? ` | ${t.projectName}` : ''})`)
          .join('\n')}`,
        data: formatted,
      },
    ],
  };
}

async function handleUpdateTask(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const taskIdInput = String(args.taskId || '').trim();
  if (!taskIdInput) {
    return { isError: true, content: [{ type: 'text', text: 'taskId is required.' }] };
  }

  // Find task by ID or taskNumber
  const existing = await prisma.task.findFirst({
    where: {
      OR: [
        { id: taskIdInput },
        { taskNumber: { equals: taskIdInput, mode: 'insensitive' } },
      ],
    },
    select: { id: true, taskNumber: true, title: true, projectId: true },
  });

  if (!existing) {
    return { isError: true, content: [{ type: 'text', text: `Task "${taskIdInput}" not found.` }] };
  }

  const updateData: Prisma.TaskUpdateInput = {};

  if (args.title && typeof args.title === 'string') {
    updateData.title = args.title.trim();
  }

  if (args.status && typeof args.status === 'string') {
    updateData.status = args.status.toLowerCase() as Prisma.TaskUpdateInput['status'];
  }

  if (args.priority && typeof args.priority === 'string') {
    updateData.priority = args.priority.toLowerCase() as Prisma.TaskUpdateInput['priority'];
  }

  if (args.dueDate !== undefined) {
    updateData.dueDate = parseNaturalDate(args.dueDate) || null;
  }

  if (args.description !== undefined) {
    updateData.description = typeof args.description === 'string' ? args.description.trim() : null;
  }

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  try {
    await logActivity(updated.id, 'Task updated via FlowSync MCP Agent', '🤖');
    if (updated.projectId) {
      await recomputeProjectProgress(updated.projectId);
    }
  } catch {}

  const resultObj = {
    id: updated.id,
    taskNumber: updated.taskNumber,
    title: updated.title,
    status: updated.status,
    priority: updated.priority,
    dueDate: updated.dueDate ? updated.dueDate.toISOString().split('T')[0] : null,
    projectName: updated.project?.name || null,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Updated task [${updated.taskNumber}] "${updated.title}": Status is now ${updated.status}, Priority is ${updated.priority}${updated.dueDate ? `, Due: ${updated.dueDate.toISOString().split('T')[0]}` : ''}.`,
        data: resultObj,
      },
    ],
  };
}

async function handleBatchCreateTasks(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const tasksInput = args.tasks;
  if (!Array.isArray(tasksInput) || tasksInput.length === 0) {
    return { isError: true, content: [{ type: 'text', text: 'Array of tasks is required.' }] };
  }

  const createdResults = [];
  for (const t of tasksInput) {
    if (typeof t === 'object' && t !== null && 'title' in t) {
      const res = await handleCreateTask(t as Record<string, unknown>, context);
      if (!res.isError && res.content[0]?.data) {
        createdResults.push(res.content[0].data);
      }
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Successfully created ${createdResults.length} tasks in batch.`,
        data: createdResults,
      },
    ],
  };
}

async function handleAddSubtasks(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const taskIdInput = String(args.taskId || '').trim();
  const subtaskTitles = Array.isArray(args.subtaskTitles) ? args.subtaskTitles.map(String) : [];

  if (!taskIdInput || subtaskTitles.length === 0) {
    return { isError: true, content: [{ type: 'text', text: 'taskId and non-empty subtaskTitles are required.' }] };
  }

  const existing = await prisma.task.findFirst({
    where: {
      OR: [
        { id: taskIdInput },
        { taskNumber: { equals: taskIdInput, mode: 'insensitive' } },
      ],
    },
    select: { id: true, taskNumber: true, title: true },
  });

  if (!existing) {
    return { isError: true, content: [{ type: 'text', text: `Task "${taskIdInput}" not found.` }] };
  }

  await prisma.subTask.createMany({
    data: subtaskTitles.map(title => ({
      taskId: existing.id,
      title: title.trim(),
      done: false,
    })),
  });

  return {
    content: [
      {
        type: 'text',
        text: `Added ${subtaskTitles.length} subtask(s) to [${existing.taskNumber}] "${existing.title}".`,
      },
    ],
  };
}

async function handleListProjects(
  args: Record<string, unknown>,
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const search = typeof args.search === 'string' ? args.search.trim() : undefined;

  const projects = await prisma.project.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    take: 20,
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      health: true,
      progress: true,
      _count: { select: { tasks: true } },
    },
  });

  const formatted = projects.map(p => ({
    id: p.id,
    name: p.name,
    health: p.health,
    progress: `${p.progress}%`,
    taskCount: p._count.tasks,
  }));

  return {
    content: [
      {
        type: 'text',
        text: `Projects in workspace:\n${formatted
          .map(p => `- ${p.name} (${p.progress} done, ${p.taskCount} tasks, health: ${p.health}) [ID: ${p.id}]`)
          .join('\n')}`,
        data: formatted,
      },
    ],
  };
}

async function handleGetWorkspaceSummary(
  context: ExecutionContext
): Promise<McpToolCallResult> {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const [totalTasks, overdueTasks, dueNext7Days, tasksByStatus, projectsCount] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({
      where: {
        dueDate: { lt: now },
        status: { not: 'done' },
      },
    }),
    prisma.task.count({
      where: {
        dueDate: { gte: now, lte: nextWeek },
        status: { not: 'done' },
      },
    }),
    prisma.task.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.project.count(),
  ]);

  const statusMap: Record<string, number> = {};
  for (const item of tasksByStatus) {
    statusMap[item.status] = item._count;
  }

  const summary = {
    totalTasks,
    overdueTasks,
    dueNext7Days,
    statusBreakdown: statusMap,
    activeProjects: projectsCount,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Workspace Intelligence Summary:
• Total Tasks: ${totalTasks} across ${projectsCount} project(s)
• Overdue: ${overdueTasks} task(s) require immediate attention
• Due in Next 7 Days: ${dueNext7Days} task(s)
• Status Distribution:
  - Todo: ${statusMap['todo'] || 0}
  - In Progress: ${statusMap['in_progress'] || 0}
  - In Review: ${statusMap['in_review'] || 0}
  - Done: ${statusMap['done'] || 0}
  - Backlog: ${statusMap['backlog'] || 0}`,
        data: summary,
      },
    ],
  };
}
