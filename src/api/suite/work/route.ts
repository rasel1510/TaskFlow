/**
 * src/api/suite/work/route.ts — work items (epics, stories, bugs …) of a software company.
 *
 * Work items are ordinary FlowSync tasks with extra fields (type, story points, sprint, release,
 * parent, severity, bug details), so they also appear in My Tasks, Board, Calendar and Timeline.
 * Only tasks of the open company's own projects are visible here.
 *
 *   GET  /api/suite/work?sprintId=|backlog=1|releaseId=|projectId=|type=|assigneeId=|q=|cursor=
 *   POST /api/suite/work   { title, projectId, itemType, … }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';

export const dynamic = 'force-dynamic';

export const ITEM_TYPES = ['task', 'epic', 'story', 'bug', 'spike', 'tech_debt', 'chore'] as const;

export const WORK_SELECT = {
  id: true,
  taskNumber: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  itemType: true,
  storyPoints: true,
  severity: true,
  bugDetails: true,
  sprintId: true,
  releaseId: true,
  parentId: true,
  projectId: true,
  assigneeId: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, name: true } },
} as const;

export const WorkInput = z.object({
  title: z.string().trim().min(1, 'Required').max(300),
  description: z.string().trim().max(20000).optional(),
  projectId: z.string().trim().min(1, 'Choose a project').max(60),
  itemType: z.enum(ITEM_TYPES).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  storyPoints: z.coerce.number().int().min(0).max(100).nullable().optional(),
  severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']).nullable().optional(),
  bugDetails: z
    .object({
      steps: z.string().max(5000).optional(),
      expected: z.string().max(2000).optional(),
      actual: z.string().max(2000).optional(),
      environment: z.string().max(200).optional(),
      device: z.string().max(200).optional(),
    })
    .nullable()
    .optional(),
  sprintId: z.string().trim().max(60).nullable().optional(),
  releaseId: z.string().trim().max(60).nullable().optional(),
  parentId: z.string().trim().max(60).nullable().optional(),
  assigneeId: z.string().trim().max(60).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

/** Every linked id must belong to the open company. Returns an error message or null. */
export async function checkWorkLinks(teamId: string, d: Partial<z.infer<typeof WorkInput>>): Promise<string | null> {
  const checks: Promise<string | null>[] = [];
  if (d.projectId)
    checks.push(prisma.project.findFirst({ where: { id: d.projectId, teamId }, select: { id: true } }).then(r => (r ? null : 'Choose one of this company’s projects.')));
  if (d.sprintId)
    checks.push(prisma.sprint.findFirst({ where: { id: d.sprintId, teamId }, select: { id: true } }).then(r => (r ? null : 'Sprint not found.')));
  if (d.releaseId)
    checks.push(prisma.release.findFirst({ where: { id: d.releaseId, teamId }, select: { id: true } }).then(r => (r ? null : 'Release not found.')));
  if (d.parentId)
    checks.push(prisma.task.findFirst({ where: { id: d.parentId, project: { teamId } }, select: { id: true } }).then(r => (r ? null : 'Parent item not found.')));
  if (d.assigneeId)
    checks.push(prisma.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId: d.assigneeId } }, select: { id: true } }).then(r => (r ? null : 'Assign someone in this company.')));
  const errors = await Promise.all(checks);
  return errors.find(Boolean) ?? null;
}

export async function GET(req: NextRequest) {
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 100);
  const cursor = sp.get('cursor') || undefined;

  const where: Record<string, unknown> = { project: { teamId: ctx.teamId } };
  if (sp.get('backlog') === '1') {
    where.sprintId = null;
    where.status = { not: 'done' };
  }
  if (sp.get('sprintId')) where.sprintId = sp.get('sprintId');
  if (sp.get('releaseId')) where.releaseId = sp.get('releaseId');
  if (sp.get('projectId')) where.projectId = sp.get('projectId');
  if (sp.get('parentId')) where.parentId = sp.get('parentId');
  if (sp.get('assigneeId')) where.assigneeId = sp.get('assigneeId') === 'me' ? ctx.userId : sp.get('assigneeId');
  if (sp.get('open') === '1') where.status = { not: 'done' };
  const type = sp.get('type');
  if (type && (ITEM_TYPES as readonly string[]).includes(type)) where.itemType = type;
  const q = (sp.get('q') || '').trim().slice(0, 100);
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { taskNumber: { contains: q, mode: 'insensitive' } }];

  try {
    const rows = await prisma.task.findMany({
      where,
      select: WORK_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Linked pull requests per item (one query, indexed by team + task)
    const ids = items.map(t => t.id);
    const links = ids.length
      ? await prisma.codeLink.findMany({
          where: { teamId: ctx.teamId, taskId: { in: ids } },
          select: { taskId: true, state: true, url: true, number: true, repo: true, reviewState: true, checks: true },
          orderBy: { updatedAt: 'desc' },
          take: 300,
        })
      : [];
    const byTask = new Map<string, typeof links>();
    for (const l of links) {
      if (!l.taskId) continue;
      const list = byTask.get(l.taskId) ?? [];
      list.push(l);
      byTask.set(l.taskId, list);
    }

    return ok(
      items.map(t => ({ ...t, code: byTask.get(t.id) ?? [] })),
      { hasMore, nextCursor: hasMore ? items[items.length - 1].id : null, limit }
    );
  } catch (err) {
    console.error('[GET /api/suite/work]', err);
    return fail(500, 'LOAD_FAILED', 'Could not load work items.');
  }
}

export async function POST(req: NextRequest) {
  const access = await requireSuite('engineering');
  if (!access.ok) return access.response;
  const ctx = access.value;

  const parsed = WorkInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'VALIDATION', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input');
  }
  const d = parsed.data;
  const linkError = await checkWorkLinks(ctx.teamId, d);
  if (linkError) return fail(400, 'BAD_LINK', linkError);

  try {
    // Same numbering as the rest of FlowSync (TF-001 …), used to link GitHub branches and PRs
    const count = await prisma.task.count();
    const created = await prisma.task.create({
      data: {
        taskNumber: `TF-${String(count + 1).padStart(3, '0')}`,
        title: d.title,
        description: d.description,
        projectId: d.projectId,
        creatorId: ctx.userId,
        assigneeId: d.assigneeId ?? null,
        status: d.status ?? (d.sprintId ? 'todo' : 'backlog'),
        priority: d.priority ?? (d.severity === 'sev1' ? 'urgent' : d.severity === 'sev2' ? 'high' : 'medium'),
        itemType: d.itemType ?? 'task',
        storyPoints: d.storyPoints ?? null,
        severity: d.itemType === 'bug' ? d.severity ?? 'sev3' : null,
        bugDetails: d.itemType === 'bug' && d.bugDetails ? d.bugDetails : undefined,
        sprintId: d.sprintId ?? null,
        releaseId: d.releaseId ?? null,
        parentId: d.parentId ?? null,
        dueDate: d.dueDate ?? null,
      },
      select: WORK_SELECT,
    });
    await audit(ctx, 'work.create', created.id, { type: created.itemType });
    return ok({ ...created, code: [] });
  } catch (err) {
    console.error('[POST /api/suite/work]', err);
    return fail(500, 'SAVE_FAILED', 'Could not create the work item.');
  }
}
