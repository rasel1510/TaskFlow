'use client';

/**
 * Insights — company measures by department: overview (leaders), engineering (DORA + flow),
 * sales, marketing and customers. Lightweight bar charts (no chart library).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveRefresh } from '@/lib/liveSync';
import { suiteApi } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Empty, PageShell, SectionHeader, Skeleton, Stat, money } from '@/components/suite/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
function useMetrics(section: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    suiteApi(`/api/suite/metrics?section=${section}`).then(d => { setData(d); setError(null); }).catch(e => setError((e as Error).message));
  }, [section]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  useLiveRefresh(['suite', 'tasks'], load);
  return { data, error };
}

function Bars({ items, format = (v: number) => String(v) }: { items: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="flex items-end gap-2 h-36" role="img" aria-label={items.map(i => `${i.label}: ${format(i.value)}`).join(', ')}>
      {items.map((i, idx) => (
        <div key={`${i.label}-${idx}`} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
          <span className="text-[11px] text-neutral-500 tabular-nums">{format(i.value)}</span>
          <div className="w-full max-w-[44px] rounded-t-md bg-[#2563EB]/80" style={{ height: `${Math.max(2, (i.value / max) * 100)}%` }} />
          <span className="text-[11px] text-neutral-400 truncate max-w-full">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

const hours = (h: number | null) => (h === null || h === undefined ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24)} days`);
const days = (d: number | null) => (d === null || d === undefined ? '—' : `${Math.round(d * 10) / 10} days`);

function Engineering() {
  const { data, error } = useMetrics('engineering');
  if (error) return <Empty title="Couldn’t load" hint={error} />;
  if (!data) return <Skeleton rows={4} />;
  const { dora, flow, velocity } = data;
  const rate = (r: number | null) => (r === null ? '—' : `${r}%`);
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Delivery (DORA)" hint="Industry-standard measures of how fast and how safely the team ships. Last 30 days; restore time over 90 days." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Deployment frequency" value={`${dora.deploysPerWeek} / week`} hint="Successful production deploys" />
          <Stat label="Lead time for changes" value={hours(dora.leadTimeHours)} hint="Merge → live in production (median)" />
          <Stat label="Change failure rate" value={rate(dora.changeFailureRate)} hint="Failed deploys and rollbacks" tone={dora.changeFailureRate > 15 ? 'bad' : undefined} />
          <Stat label="Time to restore" value={hours(dora.timeToRestoreHours)} hint="Incident start → resolved (median)" />
        </div>
      </section>
      <section>
        <SectionHeader title="Flow" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Stat label="Cycle time" value={days(flow.cycleTimeDays)} hint="Created → done (median, 4 weeks)" />
          <Stat label="Work in progress" value={flow.wip} hint="In progress + in review" />
          <Stat label="New bugs" value={flow.bugsLast30} hint="Last 30 days" />
          <Stat label="Incidents" value={flow.incidentsLast90} hint={`${flow.sev1Last90} SEV1 · last 90 days`} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-[12px] font-medium text-neutral-700 mb-3">Items completed per week</p>
            <Bars items={flow.throughputPerWeek.map((v: number, i: number) => ({ label: i === 3 ? 'This wk' : `${3 - i} wk ago`, value: v }))} />
          </div>
          <div className="border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-[12px] font-medium text-neutral-700 mb-3">Velocity (points per completed sprint)</p>
            {velocity.length ? <Bars items={velocity.map((v: any) => ({ label: v.sprint, value: v.points }))} /> : <p className="text-[12.5px] text-neutral-500">Complete a sprint to see velocity.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Sales() {
  const { data, error } = useMetrics('sales');
  const { memberName } = useSuite();
  if (error) return <Empty title="Couldn’t load" hint={error} />;
  if (!data) return <Skeleton rows={4} />;
  const STAGES = ['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation'];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open pipeline" value={money(data.pipelineCents)} hint={`${data.openCount} deals · forecast ${money(data.weightedCents)}`} />
        <Stat label="Win rate" value={data.winRate === null ? '—' : `${data.winRate}%`} hint="Closed in the last 90 days" />
        <Stat label="Average deal" value={money(data.avgDealCents)} />
        <Stat label="Sales cycle" value={days(data.salesCycleDays)} hint="Created → won (median)" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-[12px] font-medium text-neutral-700 mb-3">Won per month</p>
          <Bars items={data.wonByMonth.map((m: any) => ({ label: m.month, value: Math.round(m.wonCents / 100) }))} format={v => money(v * 100)} />
        </div>
        <div className="border border-[#E5E7EB] rounded-xl p-4">
          <p className="text-[12px] font-medium text-neutral-700 mb-3">Pipeline by stage</p>
          <Bars items={STAGES.map(s => ({ label: s, value: Math.round((data.byStage[s]?.valueCents ?? 0) / 100) }))} format={v => money(v * 100)} />
        </div>
      </div>
      <section>
        <SectionHeader title="Top this quarter" />
        {data.topThisQuarter.length ? (
          <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
            {data.topThisQuarter.map((t: any) => (
              <li key={t.userId} className="px-4 py-2.5 flex justify-between text-[13px]"><span>{memberName(t.userId)}</span><span className="tabular-nums">{money(t.cents)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-neutral-500">No deals won this quarter yet.</p>
        )}
      </section>
    </div>
  );
}

function Marketing() {
  const { data, error } = useMetrics('marketing');
  if (error) return <Empty title="Couldn’t load" hint={error} />;
  if (!data) return <Skeleton rows={4} />;
  const leads = data.perCampaign.reduce((s: number, c: any) => s + c.leads, 0);
  const spent = data.perCampaign.reduce((s: number, c: any) => s + c.spentCents, 0);
  const won = data.perCampaign.reduce((s: number, c: any) => s + c.wonCents, 0);
  const sources = Object.entries(data.leadsBySource90 as Record<string, number>).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Leads from campaigns" value={leads} />
        <Stat label="Cost per lead" value={leads ? money(Math.round(spent / leads)) : '—'} />
        <Stat label="Revenue from campaigns" value={money(won)} hint={spent ? `${(won / spent).toFixed(1)}× spend` : undefined} tone={won ? 'good' : undefined} />
        <Stat label="Content published" value={data.publishedLast30} hint="Last 30 days" />
      </div>
      <div className="border border-[#E5E7EB] rounded-xl p-4">
        <p className="text-[12px] font-medium text-neutral-700 mb-3">New leads by source (90 days)</p>
        {sources.length ? <Bars items={sources.slice(0, 8).map(([k, v]) => ({ label: k.replace('_', ' '), value: v }))} /> : <p className="text-[12.5px] text-neutral-500">No leads recorded yet.</p>}
      </div>
    </div>
  );
}

function Customers() {
  const { data, error } = useMetrics('customers');
  if (error) return <Empty title="Couldn’t load" hint={error} />;
  if (!data) return <Skeleton rows={4} />;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Monthly recurring revenue" value={money(data.mrrCents)} hint={`${data.activeAccounts} customers`} />
        <Stat label="Churned (90 days)" value={data.churned90.count} hint={`${money(data.churned90.mrrCents)} MRR lost`} tone={data.churned90.count ? 'bad' : undefined} />
        <Stat label="Open tickets" value={data.openTickets} hint={`${data.slaBreached} past response time`} tone={data.slaBreached ? 'bad' : undefined} />
        <Stat label="NPS" value={data.nps === null ? '—' : data.nps} hint={`${data.npsResponses} responses · 6 months`} />
      </div>
      <section>
        <SectionHeader title="At-risk customers" hint={`${data.renewals30} renewal(s) in the next 30 days`} />
        {data.atRisk.length ? (
          <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
            {data.atRisk.map((a: any) => <li key={a.id} className="px-4 py-2.5 flex justify-between text-[13px]"><span>{a.name}</span><span className="tabular-nums">{money(a.mrrCents)}</span></li>)}
          </ul>
        ) : (
          <p className="text-[12.5px] text-neutral-500">No customers marked at risk.</p>
        )}
      </section>
    </div>
  );
}

function Overview() {
  const { data, error } = useMetrics('overview');
  if (error) return <Empty title="Couldn’t load" hint={error} />;
  if (!data) return <Skeleton rows={4} />;
  const { engineering: e, sales: s, customers: c } = data;
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Company at a glance" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Monthly recurring revenue" value={money(c.mrrCents)} hint={`${c.activeAccounts} customers`} />
          <Stat label="Open pipeline" value={money(s.pipelineCents)} hint={`Forecast ${money(s.weightedCents)}`} />
          <Stat label="Active projects" value={data.projects} />
          <Stat label="Open incidents" value={data.openIncidents} tone={data.openIncidents ? 'bad' : 'good'} hint={data.openIncidents ? 'Needs attention' : 'All clear'} />
        </div>
      </section>
      <section>
        <SectionHeader title="Health" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Deploys per week" value={e.dora.deploysPerWeek} />
          <Stat label="Change failure rate" value={e.dora.changeFailureRate === null ? '—' : `${e.dora.changeFailureRate}%`} />
          <Stat label="Win rate" value={s.winRate === null ? '—' : `${s.winRate}%`} />
          <Stat label="NPS" value={c.nps === null ? '—' : c.nps} hint={`${c.slaBreached} tickets past response time`} />
        </div>
        {data.nextRelease && <p className="text-[12.5px] text-neutral-500 mt-3">Next release: {data.nextRelease.version} ({String(data.nextRelease.stage).replace('_', ' ')})</p>}
      </section>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function InsightsHub() {
  const { suite } = useSuite();
  const tabs = useMemo(() => {
    const s = suite?.insights;
    if (!s) return [];
    return [
      s.overview && { id: 'overview', label: 'Overview' },
      s.engineering && { id: 'engineering', label: 'Engineering' },
      s.sales && { id: 'sales', label: 'Sales' },
      s.marketing && { id: 'marketing', label: 'Marketing' },
      s.customers && { id: 'customers', label: 'Customers' },
    ].filter(Boolean) as { id: string; label: string }[];
  }, [suite?.insights]);
  const [tab, setTab] = useState('');
  const current = tabs.find(t => t.id === tab)?.id ?? tabs[0]?.id;

  if (suite && !suite.enabled) return <PageShell title="Insights"><Empty title="Not available" /></PageShell>;
  return (
    <PageShell title="Insights" subtitle={suite?.teamName} tabs={tabs} tab={current} onTab={setTab}>
      {!suite ? <Skeleton rows={4} /> : null}
      {current === 'overview' && <Overview />}
      {current === 'engineering' && <Engineering />}
      {current === 'sales' && <Sales />}
      {current === 'marketing' && <Marketing />}
      {current === 'customers' && <Customers />}
    </PageShell>
  );
}
