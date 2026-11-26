/**
 * /p/<token> — public, read-only pages shared by a software company:
 *   client_portal  progress of a client project, payment milestones and change requests to approve
 *   changelog      released versions of a product with their release notes
 *   status         current status of a product (production deployments and incidents)
 *
 * Only what the client needs is shown — no emails, internal notes or member details.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import PortalDecision from './PortalDecision';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'FlowSync', robots: { index: false, follow: false } };

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtMoney = (cents: number | null | undefined, currency = 'USD') => {
  if (cents === null || cents === undefined) return '—';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
};

/** Minimal, safe rendering of release notes (headings and bullets; everything else as text). */
function Notes({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[14px] text-neutral-700">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (t.startsWith('### ')) return <h4 key={i} className="pt-2 text-[13px] font-semibold text-neutral-900">{t.slice(4)}</h4>;
        if (t.startsWith('## ')) return null; // version heading is shown separately
        if (t.startsWith('- ')) return <p key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-neutral-400">{t.slice(2)}</p>;
        return <p key={i}>{t.replace(/^_|_$/g, '')}</p>;
      })}
    </div>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-neutral-500">{subtitle}</p>}
        </header>
        {children}
        <footer className="mt-16 pt-6 border-t border-neutral-100 text-[12px] text-neutral-400">Shared with FlowSync</footer>
      </div>
    </main>
  );
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,80}$/.test(token)) notFound();
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link?.enabled) notFound();
  const team = await prisma.team.findUnique({ where: { id: link.teamId }, select: { name: true, workspaceType: true } });
  if (!team || team.workspaceType !== 'software') notFound();

  if (link.kind === 'client_portal') {
    const project = await prisma.project.findFirst({ where: { id: link.targetId, teamId: link.teamId }, select: { id: true, name: true, description: true, dueDate: true } });
    if (!project) notFound();
    const [total, done, recent, payments, changes] = await Promise.all([
      prisma.task.count({ where: { projectId: project.id, parentId: null } }),
      prisma.task.count({ where: { projectId: project.id, parentId: null, status: 'done' } }),
      prisma.task.findMany({ where: { projectId: project.id, status: 'done' }, select: { title: true, completedAt: true }, orderBy: { completedAt: 'desc' }, take: 10 }),
      prisma.paymentMilestone.findMany({ where: { projectId: project.id, teamId: link.teamId }, orderBy: { createdAt: 'asc' }, take: 50 }),
      prisma.changeRequest.findMany({ where: { projectId: project.id, teamId: link.teamId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <Shell title={project.name} subtitle={`${team.name} · client portal`}>
        <section className="mb-10">
          <div className="flex justify-between text-[13px] text-neutral-500 mb-1.5"><span>{done} of {total} items done</span><span>{pct}%</span></div>
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
          {project.dueDate && <p className="mt-2 text-[13px] text-neutral-500">Target date: {fmtDate(project.dueDate)}</p>}
        </section>

        {changes.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[15px] font-semibold mb-3">Change requests</h2>
            <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
              {changes.map(c => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{c.title}</p>
                      {c.description && <p className="text-[13px] text-neutral-500 mt-0.5 whitespace-pre-wrap">{c.description}</p>}
                      <p className="text-[12.5px] text-neutral-500 mt-1">
                        {c.estimateHours ? `${c.estimateHours} hours` : 'Not estimated yet'}{c.priceCents ? ` · ${fmtMoney(c.priceCents, c.currency)}` : ''}
                      </p>
                    </div>
                    {c.status === 'estimated' ? (
                      <PortalDecision token={token} changeRequestId={c.id} />
                    ) : (
                      <span className="text-[12px] text-neutral-500 capitalize shrink-0">{c.status}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {payments.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[15px] font-semibold mb-3">Payments</h2>
            <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
              {payments.map(p => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 text-[14px]">
                  <span>{p.title}</span>
                  <span className="text-neutral-500 text-[13px]">{fmtMoney(p.amountCents, p.currency)} · {p.status === 'paid' ? 'Paid' : p.status === 'invoiced' ? 'Invoiced' : p.dueDate ? `Due ${fmtDate(p.dueDate)}` : 'Upcoming'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <h2 className="text-[15px] font-semibold mb-3">Recently completed</h2>
            <ul className="space-y-1.5 text-[14px] text-neutral-700">
              {recent.map((t, i) => (
                <li key={i} className="flex justify-between gap-3"><span>{t.title}</span><span className="text-neutral-400 text-[12.5px] shrink-0">{fmtDate(t.completedAt)}</span></li>
              ))}
            </ul>
          </section>
        )}
      </Shell>
    );
  }

  const product = await prisma.product.findFirst({ where: { id: link.targetId, teamId: link.teamId }, select: { id: true, name: true, description: true } });
  if (!product) notFound();

  if (link.kind === 'changelog') {
    const releases = await prisma.release.findMany({
      where: { teamId: link.teamId, productId: product.id, stage: 'released' },
      select: { version: true, title: true, releasedAt: true, notes: true },
      orderBy: { releasedAt: 'desc' },
      take: 50,
    });
    return (
      <Shell title={`${product.name} changelog`} subtitle={team.name}>
        {releases.length === 0 ? (
          <p className="text-[14px] text-neutral-500">No releases yet.</p>
        ) : (
          <ol className="space-y-10">
            {releases.map(r => (
              <li key={r.version}>
                <div className="flex items-baseline gap-3 mb-2">
                  <h2 className="text-[17px] font-semibold">{r.version}</h2>
                  {r.title && <span className="text-[14px] text-neutral-500">{r.title}</span>}
                  <span className="ml-auto text-[12.5px] text-neutral-400">{fmtDate(r.releasedAt)}</span>
                </div>
                {r.notes ? <Notes text={r.notes} /> : <p className="text-[14px] text-neutral-500">Improvements and fixes.</p>}
              </li>
            ))}
          </ol>
        )}
      </Shell>
    );
  }

  // status page
  const components = await prisma.productComponent.findMany({ where: { productId: product.id, teamId: link.teamId, status: { not: 'retired' } }, select: { id: true, name: true }, take: 30 });
  const compIds = components.map(c => c.id);
  const [deploys, open, recentIncidents] = await Promise.all([
    prisma.deployment.findMany({ where: { teamId: link.teamId, componentId: { in: compIds }, environment: 'production' }, select: { componentId: true, state: true, deployedAt: true }, orderBy: { deployedAt: 'desc' }, take: 200 }),
    prisma.incident.findMany({ where: { teamId: link.teamId, status: { not: 'resolved' }, OR: [{ componentId: { in: compIds } }, { componentId: null }] }, select: { title: true, status: true, severity: true, startedAt: true }, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.incident.findMany({ where: { teamId: link.teamId, status: 'resolved', resolvedAt: { gte: new Date(Date.now() - 14 * 86400000) }, OR: [{ componentId: { in: compIds } }, { componentId: null }] }, select: { title: true, startedAt: true, resolvedAt: true }, orderBy: { resolvedAt: 'desc' }, take: 10 }),
  ]);
  const operational = open.length === 0;
  return (
    <Shell title={`${product.name} status`} subtitle={team.name}>
      <div className={`rounded-xl px-5 py-4 mb-8 ${operational ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
        <p className="text-[15px] font-medium">{operational ? 'All systems operational' : 'Some systems are affected'}</p>
      </div>
      {open.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[15px] font-semibold mb-3">Ongoing</h2>
          <ul className="space-y-3">
            {open.map((i, idx) => (
              <li key={idx} className="border border-neutral-200 rounded-xl px-4 py-3">
                <p className="text-[14px] font-medium">{i.title}</p>
                <p className="text-[12.5px] text-neutral-500 capitalize">{i.status} · since {fmtDate(i.startedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {components.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[15px] font-semibold mb-3">Components</h2>
          <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
            {components.map(c => {
              const last = deploys.find(d => d.componentId === c.id);
              return (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between text-[14px]">
                  <span>{c.name}</span>
                  <span className="text-[12.5px] text-neutral-500">{last ? (last.state === 'error' ? 'Deploy issue' : 'Operational') : 'Operational'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-[15px] font-semibold mb-3">Past 14 days</h2>
        {recentIncidents.length === 0 ? (
          <p className="text-[14px] text-neutral-500">No incidents.</p>
        ) : (
          <ul className="space-y-2 text-[14px]">
            {recentIncidents.map((i, idx) => <li key={idx}>{i.title} <span className="text-neutral-400 text-[12.5px]">· resolved {fmtDate(i.resolvedAt)}</span></li>)}
          </ul>
        )}
      </section>
    </Shell>
  );
}
