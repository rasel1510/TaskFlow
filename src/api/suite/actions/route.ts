/**
 * src/api/suite/actions/route.ts — workflows that connect the teams of a software company.
 *
 *   POST /api/suite/actions  { action, ... }
 *
 *   sprint.start        { sprintId }
 *   sprint.complete     { sprintId, carryToSprintId? }      unfinished items move on (or to the backlog)
 *   release.notes       { releaseId }                       release notes from the linked work items
 *   release.stage       { releaseId, stage }                "released" → launch checklist + feature requests
 *   release.signoff     { releaseId, role }
 *   deal.won            { dealId }                          client project + backlog + customer account
 *   deal.lost           { dealId, reason }
 *   ticket.escalate     { ticketId, projectId }             support ticket → linked bug for engineering
 *   request.vote        { requestId, accountId?, note? }
 *   incident.update     { incidentId, status?, message }    SEV1 → on-call notified
 *   testrun.signoff     { testRunId }
 *   doc.approve         { docId }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit, type SuiteContext } from '@/lib/suite/server';
import type { SuiteModule } from '@/lib/suite/departments';
import { postToChat } from '@/lib/suite/integrations';

export const dynamic = 'force-dynamic';

const id = z.string().trim().min(1).max(60);
const ACTIONS = {
  'sprint.start': { module: 'engineering', schema: z.object({ sprintId: id }) },
  'sprint.complete': { module: 'engineering', schema: z.object({ sprintId: id, carryToSprintId: id.nullable().optional() }) },
  'release.notes': { module: 'engineering', schema: z.object({ releaseId: id }) },
  'release.stage': {
    module: 'engineering',
    schema: z.object({ releaseId: id, stage: z.enum(['planned', 'development', 'code_freeze', 'qa', 'staging', 'released', 'rolled_back']) }),
  },
  'release.signoff': { module: 'engineering', schema: z.object({ releaseId: id, role: z.enum(['qa', 'security', 'product', 'engineering']) }) },
  'deal.won': { module: 'sales', schema: z.object({ dealId: id }) },
  'deal.lost': { module: 'sales', schema: z.object({ dealId: id, reason: z.string().trim().max(300).default('') }) },
  'ticket.escalate': { module: 'customers', schema: z.object({ ticketId: id, projectId: id }) },
  'request.vote': { module: 'customers', schema: z.object({ requestId: id, accountId: id.nullable().optional(), note: z.string().trim().max(300).optional() }) },
  'incident.update': {
    module: 'engineering',
    schema: z.object({
      incidentId: id,
      status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
      message: z.string().trim().min(1).max(2000),
    }),
  },
  'testrun.signoff': { module: 'engineering', schema: z.object({ testRunId: id }) },
  'doc.approve': { module: 'engineering', schema: z.object({ docId: id }) },
} as const satisfies Record<string, { module: SuiteModule; schema: z.ZodTypeAny }>;

type ActionName = keyof typeof ACTIONS;

async function notify(userIds: string[], type: string, title: string, body: string, taskId?: string) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  await prisma.notification
    .createMany({ data: unique.map(userId => ({ userId, type, title, body, taskId: taskId ?? null })) })
    .catch(err => console.warn('[suite/actions] notify failed', (err as Error)?.message));
}

async function nextTaskNumber() {
  const count = await prisma.task.count();
  return (n: number) => `TF-${String(count + n).padStart(3, '0')}`;
}

const LAUNCH_ITEMS = [
  { title: 'Release announcement', channel: 'announcement' },
  { title: 'Blog post', channel: 'blog' },
  { title: 'Social media posts', channel: 'social' },
  { title: 'Email to customers', channel: 'email' },
  { title: 'Website update', channel: 'website' },
] as const;

async function run(action: ActionName, input: Record<string, unknown>, ctx: SuiteContext) {
  const T = ctx.teamId;
  switch (action) {
    case 'sprint.start': {
      const sprint = await prisma.sprint.findFirst({ where: { id: input.sprintId as string, teamId: T } });
      if (!sprint) return fail(404, 'NOT_FOUND', 'Sprint not found');
      const updated = await prisma.sprint.update({ where: { id: sprint.id }, data: { status: 'active' } });
      // Items planned into the sprint move from Backlog to To do
      await prisma.task.updateMany({ where: { sprintId: sprint.id, status: 'backlog' }, data: { status: 'todo' } });
      await audit(ctx, 'sprint.start', sprint.id);
      return ok(updated);
    }

    case 'sprint.complete': {
      const sprint = await prisma.sprint.findFirst({ where: { id: input.sprintId as string, teamId: T } });
      if (!sprint) return fail(404, 'NOT_FOUND', 'Sprint not found');
      const carryTo = (input.carryToSprintId as string | null | undefined) || null;
      if (carryTo) {
        const target = await prisma.sprint.findFirst({ where: { id: carryTo, teamId: T, status: { not: 'completed' } }, select: { id: true } });
        if (!target) return fail(400, 'BAD_LINK', 'Choose a sprint that is not completed.');
      }
      const moved = await prisma.task.updateMany({
        where: { sprintId: sprint.id, status: { not: 'done' } },
        data: carryTo ? { sprintId: carryTo } : { sprintId: null, status: 'backlog' },
      });
      const updated = await prisma.sprint.update({ where: { id: sprint.id }, data: { status: 'completed', completedAt: new Date() } });
      await audit(ctx, 'sprint.complete', sprint.id, { carried: moved.count });
      return ok({ sprint: updated, carried: moved.count });
    }

    case 'release.notes': {
      const release = await prisma.release.findFirst({ where: { id: input.releaseId as string, teamId: T } });
      if (!release) return fail(404, 'NOT_FOUND', 'Release not found');
      const items = await prisma.task.findMany({
        where: { releaseId: release.id, project: { teamId: T } },
        select: { taskNumber: true, title: true, itemType: true, status: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      const group = (types: string[]) => items.filter(i => types.includes(i.itemType) && i.status === 'done');
      const sections: [string, typeof items][] = [
        ['New', group(['epic', 'story', 'task', 'spike'])],
        ['Fixed', group(['bug'])],
        ['Improved', group(['tech_debt', 'chore'])],
      ];
      const lines = [`## ${release.version}${release.title ? ` — ${release.title}` : ''}`, ''];
      for (const [title, list] of sections) {
        if (!list.length) continue;
        lines.push(`### ${title}`, ...list.map(i => `- ${i.title}${i.taskNumber ? ` (${i.taskNumber})` : ''}`), '');
      }
      if (lines.length === 2) lines.push('_No completed work items are linked to this release yet._');
      const notes = lines.join('\n').trim();
      const updated = await prisma.release.update({ where: { id: release.id }, data: { notes } });
      await audit(ctx, 'release.notes', release.id);
      return ok(updated);
    }

    case 'release.stage': {
      const release = await prisma.release.findFirst({ where: { id: input.releaseId as string, teamId: T } });
      if (!release) return fail(404, 'NOT_FOUND', 'Release not found');
      const stage = input.stage as string;
      const shipping = stage === 'released' && release.stage !== 'released';
      const updated = await prisma.release.update({
        where: { id: release.id },
        data: { stage, ...(shipping ? { releasedAt: new Date() } : {}), ...(stage !== 'released' && stage !== 'rolled_back' ? { releasedAt: null } : {}) },
      });
      let launch = 0;
      let requestsShipped = 0;
      if (shipping) {
        // Marketing launch checklist (once per release)
        if (ctx.settings.launchChecklistOnRelease) {
          const existing = await prisma.contentItem.count({ where: { teamId: T, releaseId: release.id } });
          if (existing === 0) {
            const publishAt = new Date(Date.now() + 2 * 86400_000);
            const res = await prisma.contentItem.createMany({
              data: LAUNCH_ITEMS.map(item => ({
                teamId: T,
                releaseId: release.id,
                title: `${item.title} — ${release.version}`,
                channel: item.channel,
                stage: 'idea',
                publishAt,
                notes: release.notes ? `Release notes:\n\n${release.notes}` : '',
              })),
            });
            launch = res.count;
          }
        }
        // Feature requests delivered by this release are marked shipped; requesters are told
        const delivered = await prisma.featureRequest.findMany({
          where: { teamId: T, releaseId: release.id, status: { not: 'shipped' } },
          select: { id: true, title: true, createdById: true },
        });
        if (delivered.length) {
          await prisma.featureRequest.updateMany({ where: { id: { in: delivered.map(d => d.id) } }, data: { status: 'shipped' } });
          requestsShipped = delivered.length;
          for (const d of delivered) {
            if (d.createdById) await notify([d.createdById], 'feature_shipped', 'Feature shipped', `“${d.title}” shipped in ${release.version}. Let the customers who asked know.`);
          }
        }
        // Marketing team hears about the release
        const marketers = await prisma.teamMembership.findMany({ where: { teamId: T, department: 'marketing' }, select: { userId: true }, take: 50 });
        await notify(marketers.map(m => m.userId), 'release_shipped', `${release.version} released`, 'The launch checklist is ready in Marketing → Content.');
        await postToChat(T, `🚀 ${release.version}${release.title ? ` — ${release.title}` : ''} is released.`);
      }
      await audit(ctx, 'release.stage', release.id, { stage, launch, requestsShipped });
      return ok({ release: updated, launch, requestsShipped });
    }

    case 'release.signoff': {
      const release = await prisma.release.findFirst({ where: { id: input.releaseId as string, teamId: T } });
      if (!release) return fail(404, 'NOT_FOUND', 'Release not found');
      const role = input.role as string;
      const list = ((release.signoffs as { role: string; userId: string; at: string }[] | null) || []).filter(s => s.role !== role);
      list.push({ role, userId: ctx.userId, at: new Date().toISOString() });
      const updated = await prisma.release.update({ where: { id: release.id }, data: { signoffs: list } });
      await audit(ctx, 'release.signoff', release.id, { role });
      return ok(updated);
    }

    case 'deal.won': {
      const deal = await prisma.deal.findFirst({ where: { id: input.dealId as string, teamId: T } });
      if (!deal) return fail(404, 'NOT_FOUND', 'Deal not found');
      let projectId = deal.projectId;
      let backlog = 0;
      if (!projectId && ctx.settings.projectOnDealWon) {
        // Client project with the agreed requirements as backlog stories (one per line)
        const project = await prisma.project.create({
          data: {
            name: deal.companyName ? `${deal.companyName} — ${deal.title}` : deal.title,
            description: deal.requirements || `Client project created from the won deal “${deal.title}”.`,
            teamId: T,
            ownerId: ctx.userId,
            members: { create: { userId: ctx.userId, role: 'OWNER' } },
          },
          select: { id: true },
        });
        projectId = project.id;
        const lines = deal.requirements
          .split('\n')
          .map(l => l.replace(/^[-*\d.)\s]+/, '').trim())
          .filter(l => l.length > 2)
          .slice(0, 50);
        if (lines.length) {
          const num = await nextTaskNumber();
          await prisma.task.createMany({
            data: lines.map((title, i) => ({
              taskNumber: num(i + 1),
              title: title.slice(0, 300),
              projectId: project.id,
              creatorId: ctx.userId,
              status: 'backlog' as const,
              itemType: 'story',
            })),
          });
          backlog = lines.length;
        }
      }
      const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: { stage: 'won', probability: 100, wonAt: deal.wonAt ?? new Date(), lostAt: null, projectId },
      });
      // Customer account for success / renewals (once)
      const hasAccount = await prisma.customerAccount.count({ where: { teamId: T, dealId: deal.id } });
      if (!hasAccount) {
        await prisma.customerAccount.create({
          data: {
            teamId: T,
            name: deal.companyName || deal.title,
            dealId: deal.id,
            status: 'onboarding',
            startDate: new Date(),
            managerId: deal.ownerId,
            onboarding: [
              { id: 'kickoff', label: 'Kick-off meeting', done: false },
              { id: 'setup', label: 'Accounts and access set up', done: false },
              { id: 'training', label: 'Training session', done: false },
              { id: 'golive', label: 'Go-live', done: false },
            ],
          },
        });
      }
      const engineeringLeads = await prisma.teamMembership.findMany({
        where: { teamId: T, OR: [{ role: { in: ['Admin', 'Project Manager'] } }, { department: 'product' }] },
        select: { userId: true },
        take: 50,
      });
      await notify(
        engineeringLeads.map(m => m.userId).filter(u => u !== ctx.userId),
        'deal_won',
        `Deal won: ${deal.title}`,
        projectId ? `A client project${backlog ? ` with ${backlog} backlog items` : ''} is ready.` : 'Sales closed a new deal.'
      );
      await postToChat(T, `🎉 Deal won: ${deal.title}${deal.companyName ? ` (${deal.companyName})` : ''}`);
      await audit(ctx, 'deal.won', deal.id, { projectId, backlog });
      return ok({ deal: updated, projectId, backlog });
    }

    case 'deal.lost': {
      const deal = await prisma.deal.findFirst({ where: { id: input.dealId as string, teamId: T }, select: { id: true } });
      if (!deal) return fail(404, 'NOT_FOUND', 'Deal not found');
      const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: { stage: 'lost', probability: 0, lostAt: new Date(), lostReason: (input.reason as string) || '' },
      });
      await audit(ctx, 'deal.lost', deal.id);
      return ok(updated);
    }

    case 'ticket.escalate': {
      const ticket = await prisma.ticket.findFirst({ where: { id: input.ticketId as string, teamId: T } });
      if (!ticket) return fail(404, 'NOT_FOUND', 'Ticket not found');
      if (ticket.bugTaskId) return fail(400, 'ALREADY', 'This ticket is already linked to a bug.');
      const project = await prisma.project.findFirst({ where: { id: input.projectId as string, teamId: T }, select: { id: true, ownerId: true } });
      if (!project) return fail(400, 'BAD_LINK', 'Choose one of this company’s projects.');
      const severity = ticket.priority === 'urgent' ? 'sev1' : ticket.priority === 'high' ? 'sev2' : 'sev3';
      const num = await nextTaskNumber();
      const bug = await prisma.task.create({
        data: {
          taskNumber: num(1),
          title: ticket.subject,
          description: `${ticket.description}\n\nReported through support${ticket.contactEmail ? ` by ${ticket.contactEmail}` : ''}.`.trim(),
          projectId: project.id,
          creatorId: ctx.userId,
          status: 'backlog',
          priority: severity === 'sev1' ? 'urgent' : severity === 'sev2' ? 'high' : 'medium',
          itemType: 'bug',
          severity,
          bugDetails: { steps: ticket.description.slice(0, 5000) },
        },
        select: { id: true, taskNumber: true },
      });
      const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { bugTaskId: bug.id, status: 'pending' } });
      await notify([project.ownerId].filter(u => u !== ctx.userId), 'bug_escalated', `Bug from support: ${ticket.subject}`, `${bug.taskNumber} was created from a customer ticket.`, bug.id);
      await audit(ctx, 'ticket.escalate', ticket.id, { bugId: bug.id });
      return ok({ ticket: updated, bug });
    }

    case 'request.vote': {
      const request = await prisma.featureRequest.findFirst({ where: { id: input.requestId as string, teamId: T }, select: { id: true } });
      if (!request) return fail(404, 'NOT_FOUND', 'Feature request not found');
      const accountId = (input.accountId as string | null | undefined) || null;
      if (accountId) {
        const account = await prisma.customerAccount.findFirst({ where: { id: accountId, teamId: T }, select: { id: true } });
        if (!account) return fail(400, 'BAD_LINK', 'Customer not found');
        const dup = await prisma.featureVote.count({ where: { requestId: request.id, accountId } });
        if (dup) return fail(400, 'ALREADY', 'This customer already asked for it.');
      } else {
        const dup = await prisma.featureVote.count({ where: { requestId: request.id, userId: ctx.userId, accountId: null } });
        if (dup) return fail(400, 'ALREADY', 'You already voted for this.');
      }
      const vote = await prisma.featureVote.create({ data: { requestId: request.id, accountId, userId: ctx.userId, note: (input.note as string) || '' } });
      await audit(ctx, 'request.vote', request.id);
      return ok(vote);
    }

    case 'incident.update': {
      const incident = await prisma.incident.findFirst({ where: { id: input.incidentId as string, teamId: T } });
      if (!incident) return fail(404, 'NOT_FOUND', 'Incident not found');
      const status = (input.status as string | undefined) || incident.status;
      const updates = [
        ...((incident.updates as { at: string; userId: string; status: string; message: string }[] | null) || []),
        { at: new Date().toISOString(), userId: ctx.userId, status, message: input.message as string },
      ].slice(-200);
      const updated = await prisma.incident.update({
        where: { id: incident.id },
        data: { status, updates, ...(status === 'resolved' && !incident.resolvedAt ? { resolvedAt: new Date() } : {}), ...(status !== 'resolved' ? { resolvedAt: null } : {}) },
      });
      if (status === 'resolved' && incident.status !== 'resolved' && (incident.severity === 'sev1' || incident.severity === 'sev2')) {
        await postToChat(T, `✅ Resolved: ${incident.title}`);
      }
      await audit(ctx, 'incident.update', incident.id, { status });
      return ok(updated);
    }

    case 'testrun.signoff': {
      const run = await prisma.testRun.findFirst({ where: { id: input.testRunId as string, teamId: T } });
      if (!run) return fail(404, 'NOT_FOUND', 'Test run not found');
      const results = (run.results as Record<string, string> | null) || {};
      if (Object.values(results).some(r => r === 'fail' || r === 'blocked')) {
        return fail(400, 'NOT_READY', 'Failed or blocked tests must be fixed before sign-off.');
      }
      const updated = await prisma.testRun.update({ where: { id: run.id }, data: { status: 'signed_off', signedOffById: ctx.userId, signedOffAt: new Date() } });
      if (run.releaseId) {
        const release = await prisma.release.findFirst({ where: { id: run.releaseId, teamId: T } });
        if (release) {
          const list = ((release.signoffs as { role: string; userId: string; at: string }[] | null) || []).filter(s => s.role !== 'qa');
          list.push({ role: 'qa', userId: ctx.userId, at: new Date().toISOString() });
          await prisma.release.update({ where: { id: release.id }, data: { signoffs: list } });
        }
      }
      await audit(ctx, 'testrun.signoff', run.id);
      return ok(updated);
    }

    case 'doc.approve': {
      const doc = await prisma.docPage.findFirst({ where: { id: input.docId as string, teamId: T }, select: { id: true, authorId: true } });
      if (!doc) return fail(404, 'NOT_FOUND', 'Document not found');
      if (doc.authorId === ctx.userId && !ctx.isManager) return fail(403, 'FORBIDDEN', 'Someone else should approve your document.');
      const updated = await prisma.docPage.update({ where: { id: doc.id }, data: { status: 'approved', approvedById: ctx.userId, approvedAt: new Date() } });
      await audit(ctx, 'doc.approve', doc.id);
      return ok(updated);
    }
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action as ActionName | undefined;
  if (!action || !(action in ACTIONS)) return fail(400, 'UNKNOWN_ACTION', 'Unknown action');
  const def = ACTIONS[action];
  const access = await requireSuite(def.module as SuiteModule);
  if (!access.ok) return access.response;
  const parsed = def.schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'VALIDATION', first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input');
  }
  try {
    return await run(action, parsed.data as Record<string, unknown>, access.value);
  } catch (err) {
    console.error(`[POST /api/suite/actions] ${action}`, err);
    return fail(500, 'ACTION_FAILED', 'Something went wrong. Please try again.');
  }
}
