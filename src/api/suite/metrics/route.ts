/**
 * src/api/suite/metrics/route.ts — GET /api/suite/metrics?section=engineering|sales|marketing|customers|overview
 *
 * Company-level measures, computed from bounded, indexed queries. Each section is only available
 * to the departments allowed to see it (see insightSections in suite/departments.ts).
 *
 * Engineering uses the four DORA measures (deployment frequency, lead time for changes, change
 * failure rate, time to restore) plus flow measures — reported for the team, never ranking people.
 */
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok } from '@/lib/suite/server';
import { insightSections } from '@/lib/suite/departments';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function engineering(teamId: string) {
  const [deploys, merged, incidents, doneItems, wip, sprints, bugs, rolledBack, released] = await Promise.all([
    prisma.deployment.findMany({ where: { teamId, environment: 'production', deployedAt: { gte: since(30) } }, select: { state: true, deployedAt: true }, take: 2000 }),
    prisma.codeLink.findMany({ where: { teamId, state: 'merged', mergedAt: { gte: since(30) } }, select: { mergedAt: true }, take: 500 }),
    prisma.incident.findMany({ where: { teamId, startedAt: { gte: since(90) } }, select: { startedAt: true, resolvedAt: true, severity: true }, take: 500 }),
    prisma.task.findMany({ where: { project: { teamId }, status: 'done', completedAt: { gte: since(28) } }, select: { createdAt: true, completedAt: true, itemType: true, storyPoints: true }, take: 2000 }),
    prisma.task.count({ where: { project: { teamId }, status: { in: ['in_progress', 'in_review'] } } }),
    prisma.sprint.findMany({ where: { teamId, status: 'completed' }, select: { id: true, name: true, completedAt: true }, orderBy: { completedAt: 'desc' }, take: 6 }),
    prisma.task.count({ where: { project: { teamId }, itemType: 'bug', createdAt: { gte: since(30) } } }),
    prisma.release.count({ where: { teamId, stage: 'rolled_back', updatedAt: { gte: since(90) } } }),
    prisma.release.count({ where: { teamId, stage: 'released', releasedAt: { gte: since(90) } } }),
  ]);

  const okDeploys = deploys.filter(d => d.state === 'ready');
  const failed = deploys.filter(d => d.state === 'error').length;
  // Lead time: from merge to the first successful production deployment after it
  const prodTimes = okDeploys.map(d => d.deployedAt.getTime()).sort((a, b) => a - b);
  const leadHours = merged
    .map(m => {
      const t = m.mergedAt!.getTime();
      const next = prodTimes.find(p => p >= t);
      return next ? (next - t) / 3_600_000 : null;
    })
    .filter((x): x is number => x !== null);
  const restoreHours = incidents.filter(i => i.resolvedAt).map(i => (i.resolvedAt!.getTime() - i.startedAt.getTime()) / 3_600_000);
  const cycleDays = doneItems.map(i => (i.completedAt!.getTime() - i.createdAt.getTime()) / DAY);

  const velocity = await Promise.all(
    sprints.map(async s => {
      const agg = await prisma.task.aggregate({ where: { sprintId: s.id, status: 'done' }, _sum: { storyPoints: true }, _count: true });
      return { sprint: s.name, points: agg._sum.storyPoints ?? 0, items: agg._count };
    })
  );

  const weeks = [3, 2, 1, 0].map(w => {
    const from = Date.now() - (w + 1) * 7 * DAY;
    const to = Date.now() - w * 7 * DAY;
    return doneItems.filter(i => i.completedAt!.getTime() >= from && i.completedAt!.getTime() < to).length;
  });

  return {
    dora: {
      deploysPerWeek: Math.round((okDeploys.length / (30 / 7)) * 10) / 10,
      leadTimeHours: median(leadHours),
      changeFailureRate: deploys.length || released ? Math.round(((failed + rolledBack) / Math.max(1, deploys.length + released)) * 100) : null,
      timeToRestoreHours: median(restoreHours),
    },
    flow: {
      throughputPerWeek: weeks,
      cycleTimeDays: median(cycleDays),
      wip,
      bugsLast30: bugs,
      incidentsLast90: incidents.length,
      sev1Last90: incidents.filter(i => i.severity === 'sev1').length,
    },
    velocity: velocity.reverse(),
  };
}

async function sales(teamId: string) {
  const deals = await prisma.deal.findMany({
    where: { teamId, OR: [{ stage: { notIn: ['won', 'lost'] } }, { updatedAt: { gte: since(365) } }] },
    select: { stage: true, valueCents: true, probability: true, ownerId: true, createdAt: true, wonAt: true, lostAt: true, source: true },
    take: 5000,
  });
  const open = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const byStage: Record<string, { count: number; valueCents: number }> = {};
  for (const d of open) {
    byStage[d.stage] ??= { count: 0, valueCents: 0 };
    byStage[d.stage].count++;
    byStage[d.stage].valueCents += d.valueCents;
  }
  const recentClosed = deals.filter(d => (d.wonAt && d.wonAt >= since(90)) || (d.lostAt && d.lostAt >= since(90)));
  const won = deals.filter(d => d.stage === 'won' && d.wonAt);
  const months = Array.from({ length: 6 }, (_, i) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    return {
      month: start.toLocaleString('en', { month: 'short' }),
      wonCents: won.filter(d => d.wonAt! >= start && d.wonAt! < end).reduce((s, d) => s + d.valueCents, 0),
    };
  });
  const qStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
  const byOwner = new Map<string, number>();
  for (const d of won) if (d.wonAt! >= qStart && d.ownerId) byOwner.set(d.ownerId, (byOwner.get(d.ownerId) ?? 0) + d.valueCents);

  return {
    openCount: open.length,
    pipelineCents: open.reduce((s, d) => s + d.valueCents, 0),
    weightedCents: open.reduce((s, d) => s + Math.round((d.valueCents * d.probability) / 100), 0),
    byStage,
    winRate: recentClosed.length ? Math.round((recentClosed.filter(d => d.stage === 'won').length / recentClosed.length) * 100) : null,
    avgDealCents: won.length ? Math.round(won.reduce((s, d) => s + d.valueCents, 0) / won.length) : null,
    salesCycleDays: median(won.map(d => (d.wonAt!.getTime() - d.createdAt.getTime()) / DAY)),
    wonByMonth: months,
    topThisQuarter: Array.from(byOwner.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([userId, cents]) => ({ userId, cents })),
  };
}

async function marketing(teamId: string) {
  const [campaigns, contacts, deals, published] = await Promise.all([
    prisma.campaign.findMany({ where: { teamId }, select: { id: true, name: true, spentCents: true, status: true }, take: 200 }),
    prisma.contact.findMany({ where: { teamId, createdAt: { gte: since(365) } }, select: { id: true, source: true, campaignId: true, createdAt: true }, take: 10000 }),
    prisma.deal.findMany({ where: { teamId, OR: [{ campaignId: { not: null } }, { contact: { campaignId: { not: null } } }] }, select: { campaignId: true, stage: true, valueCents: true, contact: { select: { campaignId: true } } }, take: 5000 }),
    prisma.contentItem.count({ where: { teamId, stage: 'published', updatedAt: { gte: since(30) } } }),
  ]);
  const perCampaign = campaigns.map(c => {
    const leads = contacts.filter(x => x.campaignId === c.id).length;
    const attributed = deals.filter(d => (d.campaignId ?? d.contact?.campaignId) === c.id);
    const wonCents = attributed.filter(d => d.stage === 'won').reduce((s, d) => s + d.valueCents, 0);
    return { id: c.id, name: c.name, status: c.status, leads, deals: attributed.length, wonCents, spentCents: c.spentCents ?? 0 };
  });
  const bySource: Record<string, number> = {};
  for (const c of contacts.filter(x => x.createdAt >= since(90))) bySource[c.source] = (bySource[c.source] ?? 0) + 1;
  return { perCampaign, leadsBySource90: bySource, publishedLast30: published };
}

async function customers(teamId: string) {
  const [accounts, tickets, nps, churned] = await Promise.all([
    prisma.customerAccount.findMany({ where: { teamId, status: { not: 'churned' } }, select: { id: true, name: true, status: true, mrrCents: true, renewalDate: true }, take: 5000 }),
    prisma.ticket.findMany({ where: { teamId, status: { in: ['open', 'pending'] } }, select: { accountId: true, slaDueAt: true, priority: true }, take: 5000 }),
    prisma.npsResponse.findMany({ where: { teamId, createdAt: { gte: since(180) } }, select: { score: true }, take: 5000 }),
    prisma.customerAccount.findMany({ where: { teamId, status: 'churned', updatedAt: { gte: since(90) } }, select: { mrrCents: true }, take: 5000 }),
  ]);
  const now = Date.now();
  const promoters = nps.filter(n => n.score >= 9).length;
  const detractors = nps.filter(n => n.score <= 6).length;
  return {
    mrrCents: accounts.reduce((s, a) => s + a.mrrCents, 0),
    activeAccounts: accounts.length,
    atRisk: accounts.filter(a => a.status === 'at_risk').map(a => ({ id: a.id, name: a.name, mrrCents: a.mrrCents })),
    renewals30: accounts.filter(a => a.renewalDate && a.renewalDate.getTime() - now < 30 * DAY && a.renewalDate.getTime() > now).length,
    churned90: { count: churned.length, mrrCents: churned.reduce((s, a) => s + a.mrrCents, 0) },
    openTickets: tickets.length,
    slaBreached: tickets.filter(t => t.slaDueAt && t.slaDueAt.getTime() < now).length,
    nps: nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : null,
    npsResponses: nps.length,
  };
}

export async function GET(req: NextRequest) {
  const access = await requireSuite('insights');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const allowed = insightSections(ctx.department, ctx.role);
  const section = req.nextUrl.searchParams.get('section') || 'overview';
  if (!(section in allowed) || !allowed[section as keyof typeof allowed]) {
    return fail(403, 'NOT_YOUR_DEPARTMENT', 'These numbers are not available for your department.');
  }
  try {
    const T = ctx.teamId;
    if (section === 'engineering') return ok(await engineering(T));
    if (section === 'sales') return ok(await sales(T));
    if (section === 'marketing') return ok(await marketing(T));
    if (section === 'customers') return ok(await customers(T));
    const [e, s, c] = await Promise.all([engineering(T), sales(T), customers(T)]);
    const [projects, openIncidents, nextRelease] = await Promise.all([
      prisma.project.count({ where: { teamId: T, archivedAt: null } }),
      prisma.incident.count({ where: { teamId: T, status: { not: 'resolved' } } }),
      prisma.release.findFirst({ where: { teamId: T, stage: { notIn: ['released', 'rolled_back'] } }, orderBy: { targetDate: 'asc' }, select: { version: true, stage: true, targetDate: true } }),
    ]);
    return ok({ engineering: e, sales: s, customers: c, projects, openIncidents, nextRelease });
  } catch (err) {
    console.error('[GET /api/suite/metrics]', err);
    return fail(500, 'METRICS_FAILED', 'Could not calculate the numbers. Please try again.');
  }
}
