'use client';

/**
 * Engineering — the software team's home: my work, sprints, products, releases, deployments,
 * incidents, docs, QA, infrastructure and connections.
 */
import React, { useMemo, useState } from 'react';
import { useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Cell, Empty, PageShell, ProgressBar, Row, SectionHeader, Skeleton, Stat, Table, ago, date } from '@/components/suite/ui';
import Sprints from './engineering/Sprints';
import Products from './engineering/Products';
import Releases, { STAGE_LABEL, STAGE_TONE } from './engineering/Releases';
import Deployments, { STATE_TONE } from './engineering/Deployments';
import Incidents from './engineering/Incidents';
import { Docs, Infrastructure, QA } from './engineering/Knowledge';
import EngineeringSettings from './engineering/Settings';
import { PrChips, STATUS_LABEL, STATUS_TONE, TypeBadge, WorkItemDrawer, useWork, type WorkItem } from './engineering/work';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'products', label: 'Products' },
  { id: 'releases', label: 'Releases' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'docs', label: 'Docs' },
  { id: 'qa', label: 'QA' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'settings', label: 'Settings' },
];

function Overview({ onOpenTask, goTo }: { onOpenTask: (id: string) => void; goTo: (tab: string) => void }) {
  const { suite } = useSuite();
  const mine = useWork({ assigneeId: 'me', open: '1' });
  const sprints = useRecords<Rec>('sprints', { status: 'active' }, { limit: 5 });
  const active = sprints.items[0];
  const sprintWork = useWork({ sprintId: active?.id }, Boolean(active));
  const incidents = useRecords<Rec>('incidents', {}, { limit: 20 });
  const openIncidents = incidents.items.filter(i => i.status !== 'resolved');
  const releases = useRecords<Rec>('releases', {}, { limit: 20 });
  const nextRelease = releases.items.filter(r => r.stage !== 'released' && r.stage !== 'rolled_back').sort((a, b) => +new Date(a.targetDate || 8.64e15) - +new Date(b.targetDate || 8.64e15))[0];
  const prs = useRecords<Rec>('code', { state: 'open' }, { limit: 8 });
  const deploys = useRecords<Rec>('deployments', { environment: 'production' }, { limit: 5 });
  const [drawer, setDrawer] = useState<WorkItem | null>(null);

  const done = sprintWork.items.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Assigned to me" value={mine.loading ? '—' : mine.items.length} hint="Open work items" />
        <Stat label={active ? active.name : 'Active sprint'} value={active ? `${sprintWork.items.length ? Math.round((done / sprintWork.items.length) * 100) : 0}%` : '—'} hint={active ? `${done} of ${sprintWork.items.length} done · ends ${date(active.endDate)}` : 'No sprint running'} />
        <Stat label="Open incidents" value={openIncidents.length} tone={openIncidents.length ? 'bad' : 'good'} hint={openIncidents.length ? openIncidents[0].title : 'All clear'} />
        <Stat label="Next release" value={nextRelease ? nextRelease.version : '—'} hint={nextRelease ? `${STAGE_LABEL[nextRelease.stage]}${nextRelease.targetDate ? ` · ${date(nextRelease.targetDate)}` : ''}` : 'Nothing planned'} />
      </div>

      <section>
        <SectionHeader title="My work" hint={suite?.me ? undefined : undefined} />
        {mine.loading ? (
          <Skeleton rows={3} />
        ) : (
          <Table head={['Item', 'Type', 'Status', 'Project', 'Code']} empty={<Empty title="Nothing assigned to you" hint="Pick something from the sprint board or the backlog." />}>
            {mine.items.slice(0, 15).map(it => (
              <Row key={it.id} onClick={() => setDrawer(it)}>
                <Cell><span className="text-neutral-400 mr-1.5 text-[12px]">{it.taskNumber}</span>{it.title}</Cell>
                <Cell><TypeBadge type={it.itemType} /></Cell>
                <Cell><Badge tone={STATUS_TONE[it.status]}>{STATUS_LABEL[it.status]}</Badge></Cell>
                <Cell muted>{it.project?.name ?? '—'}</Cell>
                <Cell><PrChips code={it.code} /></Cell>
              </Row>
            ))}
          </Table>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeader title="Open pull requests" actions={<button type="button" onClick={() => goTo('settings')} className="text-[12px] text-[#2563EB] cursor-pointer">GitHub settings</button>} />
          {prs.items.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500 border border-[#E5E7EB] rounded-xl px-4 py-6 text-center">No open pull requests synced. Connect GitHub and add repos to your product components.</p>
          ) : (
            <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
              {prs.items.map(p => (
                <li key={p.id} className="px-3 py-2.5 text-[13px]">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2563EB]">{p.title}</a>
                  <p className="text-[11.5px] text-neutral-500 mt-0.5">
                    {p.repo}#{p.number} · {p.author ?? '—'} · {ago(p.updatedAt)}
                    {p.checks && <span className={p.checks === 'failure' ? 'text-red-600' : ''}> · checks {p.checks}</span>}
                    {p.reviewState && <span> · {String(p.reviewState).replace('_', ' ')}</span>}
                    {!p.taskId && <span className="text-amber-600"> · not linked</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionHeader title="Production" actions={<button type="button" onClick={() => goTo('deployments')} className="text-[12px] text-[#2563EB] cursor-pointer">All deployments</button>} />
          {deploys.items.length === 0 ? (
            <p className="text-[12.5px] text-neutral-500 border border-[#E5E7EB] rounded-xl px-4 py-6 text-center">No production deployments yet.</p>
          ) : (
            <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
              {deploys.items.map(d => (
                <li key={d.id} className="px-3 py-2.5 flex items-center gap-2 text-[13px]">
                  <Badge tone={STATE_TONE[d.state] ?? 'neutral'}>{d.state === 'ready' ? 'Live' : d.state}</Badge>
                  <span className="font-medium truncate">{d.projectName}</span>
                  <span className="text-neutral-500 truncate flex-1">{d.commitMessage || d.version || ''}</span>
                  <span className="text-[11.5px] text-neutral-400 shrink-0">{ago(d.deployedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {active && sprintWork.items.length > 0 && (
        <section>
          <SectionHeader title={`${active.name} progress`} actions={<button type="button" onClick={() => goTo('sprints')} className="text-[12px] text-[#2563EB] cursor-pointer">Open board</button>} />
          <ProgressBar value={(done / sprintWork.items.length) * 100} tone="green" />
          {nextRelease && <p className="text-[12px] text-neutral-500 mt-2">Next release <Badge tone={STAGE_TONE[nextRelease.stage]}>{nextRelease.version}</Badge></p>}
        </section>
      )}

      <WorkItemDrawer open={Boolean(drawer)} item={drawer} onClose={() => setDrawer(null)} onSaved={() => void mine.reload(true)} onDeleted={() => void mine.reload(true)} onOpenTask={onOpenTask} />
    </div>
  );
}

export default function EngineeringHub({ onTaskClick }: { onTaskClick: (id: string | null) => void; onOpenProject?: (id: string) => void }) {
  const { suite } = useSuite();
  const [tab, setTab] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab')) || 'overview');
  const tabs = useMemo(() => TABS, []);
  const current = tabs.some(t => t.id === tab) ? tab : 'overview';

  if (suite && !suite.enabled) {
    return (
      <PageShell title="Engineering">
        <Empty title="Not available" hint="The software company tools are not switched on for this company." />
      </PageShell>
    );
  }

  return (
    <PageShell title="Engineering" subtitle={suite?.teamName} tabs={tabs} tab={current} onTab={setTab}>
      {current === 'overview' && <Overview onOpenTask={id => onTaskClick(id)} goTo={setTab} />}
      {current === 'sprints' && <Sprints onOpenTask={id => onTaskClick(id)} />}
      {current === 'products' && <Products />}
      {current === 'releases' && <Releases />}
      {current === 'deployments' && <Deployments />}
      {current === 'incidents' && <Incidents />}
      {current === 'docs' && <Docs />}
      {current === 'qa' && <QA />}
      {current === 'infrastructure' && <Infrastructure />}
      {current === 'settings' && <EngineeringSettings />}
    </PageShell>
  );
}
