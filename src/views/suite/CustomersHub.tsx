'use client';

/**
 * Customers — accounts (health, onboarding, renewals), support tickets (SLA, escalation to
 * engineering), feature requests (votes and revenue), feedback (NPS) and client work
 * (change requests, billable time, payment milestones and the client portal link).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLiveRefresh } from '@/lib/liveSync';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, Empty, Field, Input, PageShell, Person, ProgressBar, SectionHeader, Select, Stat, ago, cx, date, money, type Tone } from '@/components/suite/ui';
import { RecordsTab, opts, type FieldDef, type RecordApi } from '@/components/suite/records';
import AiAssist from '@/components/suite/AiAssist';

const TABS = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'support', label: 'Support' },
  { id: 'requests', label: 'Feature requests' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'clients', label: 'Client work' },
];
const ACCOUNT_TONE: Record<string, Tone> = { onboarding: 'blue', active: 'green', at_risk: 'red', churned: 'neutral' };
const PRIORITY_TONE: Record<string, Tone> = { urgent: 'red', high: 'amber', normal: 'neutral', low: 'neutral' };
const TICKET_TONE: Record<string, Tone> = { open: 'blue', pending: 'amber', resolved: 'green', closed: 'neutral' };
const REQUEST_TONE: Record<string, Tone> = { open: 'neutral', planned: 'blue', in_progress: 'amber', shipped: 'green', declined: 'neutral' };

/** 0–100: status, open tickets, overdue SLAs, renewal soon and recent NPS */
function health(acc: Rec, tickets: Rec[], nps: Rec[]): number {
  let score = acc.status === 'at_risk' ? 40 : acc.status === 'onboarding' ? 75 : 85;
  const open = tickets.filter(t => t.accountId === acc.id && (t.status === 'open' || t.status === 'pending'));
  score -= Math.min(30, open.length * 8);
  if (open.some(t => t.slaDueAt && +new Date(t.slaDueAt) < Date.now())) score -= 15;
  const last = nps.find(n => n.accountId === acc.id);
  if (last) score += last.score >= 9 ? 10 : last.score <= 6 ? -15 : 0;
  if (acc.renewalDate && +new Date(acc.renewalDate) - Date.now() < 30 * 86400000) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ─────────────────────────────── Accounts ─────────────────────────────── */

function Onboarding({ rec, api }: { rec: Rec; api: RecordApi }) {
  const toast = useToast();
  const list = (rec.onboarding as { id: string; label: string; done: boolean }[] | null) || [];
  const [label, setLabel] = useState('');
  const save = (next: typeof list) => api.update(rec.id, { onboarding: next }).catch(e => toast.error((e as Error).message));
  const done = list.filter(i => i.done).length;
  return (
    <div>
      <div className="flex justify-between mb-2">
        <p className="text-[12px] font-medium text-neutral-700">Onboarding checklist</p>
        <span className="text-[11.5px] text-neutral-500">{done} / {list.length}</span>
      </div>
      <ProgressBar value={list.length ? (done / list.length) * 100 : 0} tone="green" />
      <ul className="mt-2 space-y-1.5">
        {list.map(i => (
          <li key={i.id}>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" checked={i.done} onChange={() => save(list.map(x => (x.id === i.id ? { ...x, done: !x.done } : x)))} className="w-4 h-4 accent-[#2563EB]" />
              <span className={i.done ? 'text-neutral-400' : ''}>{i.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-2">
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Add a step" onKeyDown={e => { if (e.key === 'Enter' && label.trim()) { void save([...list, { id: crypto.randomUUID().slice(0, 8), label: label.trim(), done: false }]); setLabel(''); } }} />
      </div>
    </div>
  );
}

function Accounts() {
  const { memberName } = useSuite();
  const tickets = useRecords<Rec>('tickets', {}, { limit: 100 });
  const nps = useRecords<Rec>('nps', {}, { limit: 100 });
  const fields: FieldDef[] = [
    { name: 'name', label: 'Customer', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['onboarding', 'active', 'at_risk', 'churned'], { at_risk: 'At risk' }), half: true },
    { name: 'managerId', label: 'Account manager', type: 'person', half: true },
    { name: 'plan', label: 'Plan / contract', half: true },
    { name: 'mrrCents', label: 'Monthly revenue', type: 'money', half: true },
    { name: 'startDate', label: 'Customer since', type: 'date', half: true },
    { name: 'renewalDate', label: 'Renewal date', type: 'date', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <RecordsTab
      entity="accounts"
      noun="Customer"
      fields={fields}
      defaults={{ status: 'onboarding', onboarding: [
        { id: 'kickoff', label: 'Kick-off meeting', done: false },
        { id: 'setup', label: 'Accounts and access set up', done: false },
        { id: 'training', label: 'Training session', done: false },
        { id: 'golive', label: 'Go-live', done: false },
      ] }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['onboarding', 'active', 'at_risk', 'churned'], { at_risk: 'At risk' }) }]}
      header={items => {
        const live = items.filter(a => a.status !== 'churned');
        const renewals = live.filter(a => a.renewalDate && +new Date(a.renewalDate) - Date.now() < 30 * 86400000 && +new Date(a.renewalDate) > Date.now());
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Monthly recurring revenue" value={money(live.reduce((s, a) => s + (a.mrrCents || 0), 0))} />
            <Stat label="Customers" value={live.length} />
            <Stat label="At risk" value={live.filter(a => a.status === 'at_risk' || health(a, tickets.items, nps.items) < 50).length} tone="bad" />
            <Stat label="Renewing in 30 days" value={renewals.length} hint={renewals.slice(0, 2).map(a => a.name).join(', ') || undefined} />
          </div>
        );
      }}
      empty={{ title: 'No customers yet', hint: 'Customers appear here automatically when a deal is won — or add them by hand.' }}
      columns={[
        { head: 'Customer', render: r => <span className="font-medium">{r.name}</span> },
        { head: 'Status', render: r => <Badge tone={ACCOUNT_TONE[r.status]}>{r.status === 'at_risk' ? 'At risk' : r.status}</Badge> },
        {
          head: 'Health',
          render: r => {
            const h = health(r, tickets.items, nps.items);
            return <span className={cx('tabular-nums text-[12.5px]', h < 50 ? 'text-red-600' : h < 70 ? 'text-amber-600' : 'text-emerald-600')}>{h}</span>;
          },
        },
        { head: 'MRR', render: r => money(r.mrrCents, r.currency) },
        { head: 'Renewal', render: r => date(r.renewalDate), muted: true },
        { head: 'Manager', render: r => <Person name={memberName(r.managerId)} /> },
      ]}
      detail={(rec, _c, api) => <Onboarding rec={rec} api={api} />}
    />
  );
}

/* ─────────────────────────────── Support ─────────────────────────────── */

function Escalate({ rec, api }: { rec: Rec; api: RecordApi }) {
  const toast = useToast();
  const { suite } = useSuite();
  const [projectId, setProjectId] = useState(suite?.projects?.[0]?.id ?? '');
  if (rec.bugTaskId) return <p className="text-[12.5px] text-neutral-600">Linked to an engineering bug. You will be notified in your inbox when its status changes.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-neutral-700">Send to engineering</p>
      <div className="flex gap-2">
        <Select value={projectId} onChange={e => setProjectId(e.target.value)} options={(suite?.projects || []).map(p => ({ value: p.id, label: p.name }))} placeholder="Choose project" aria-label="Project" />
        <Button
          onClick={() =>
            suiteApi<{ bug: { taskNumber: string } }>('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action: 'ticket.escalate', ticketId: rec.id, projectId }) })
              .then(r => { toast.success(`Bug ${r.bug.taskNumber} created for engineering`); void api.reload(true); })
              .catch(e => toast.error((e as Error).message))
          }
          disabled={!projectId}
        >
          Create bug
        </Button>
      </div>
      <p className="text-[11.5px] text-neutral-400">The bug gets the ticket’s details and a severity from its priority.</p>
    </div>
  );
}

function Support() {
  const { memberName } = useSuite();
  const accounts = useRecords<Rec>('accounts', {}, { limit: 100 });
  const fields: FieldDef[] = [
    { name: 'subject', label: 'Subject', required: true },
    { name: 'accountId', label: 'Customer', type: 'select', options: accounts.items.map(a => ({ value: a.id, label: String(a.name) })), half: true },
    { name: 'contactEmail', label: 'Contact email', type: 'email', half: true },
    { name: 'priority', label: 'Priority', type: 'select', required: true, options: opts(['low', 'normal', 'high', 'urgent']), half: true, hint: 'Sets the response time: urgent 4h, high 8h, normal 24h, low 72h.' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['open', 'pending', 'resolved', 'closed']), half: true },
    { name: 'assigneeId', label: 'Assignee', type: 'person', half: true },
    { name: 'description', label: 'What happened', type: 'textarea' },
  ];
  return (
    <RecordsTab
      entity="tickets"
      noun="Ticket"
      fields={fields}
      defaults={{ priority: 'normal', status: 'open' }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['open', 'pending', 'resolved', 'closed']) }, { key: 'priority', label: 'Priorities', options: opts(['urgent', 'high', 'normal', 'low']) }]}
      header={items => {
        const open = items.filter(t => t.status === 'open' || t.status === 'pending');
        const breached = open.filter(t => t.slaDueAt && +new Date(t.slaDueAt) < Date.now());
        return (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <Stat label="Open tickets" value={open.length} />
            <Stat label="Past their response time" value={breached.length} tone={breached.length ? 'bad' : 'good'} />
            <Stat label="Sent to engineering" value={items.filter(t => t.bugTaskId).length} />
          </div>
        );
      }}
      empty={{ title: 'No support tickets', hint: 'Log customer problems here. One click sends a bug to engineering.' }}
      columns={[
        { head: 'Ticket', render: r => <span className="font-medium">{r.subject}</span> },
        { head: 'Customer', render: r => accounts.items.find(a => a.id === r.accountId)?.name ?? (r.contactEmail || '—'), muted: true },
        { head: 'Priority', render: r => <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge> },
        { head: 'Status', render: r => <Badge tone={TICKET_TONE[r.status]}>{r.status}</Badge> },
        {
          head: 'Respond by',
          render: r => {
            if (r.status === 'resolved' || r.status === 'closed' || !r.slaDueAt) return <span className="text-neutral-400">—</span>;
            const late = +new Date(r.slaDueAt) < Date.now();
            return <span className={late ? 'text-red-600' : 'text-neutral-600'}>{late ? `Overdue ${ago(r.slaDueAt)}` : new Date(r.slaDueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>;
          },
        },
        { head: 'Assignee', render: r => <Person name={memberName(r.assigneeId)} /> },
        { head: 'Bug', render: r => (r.bugTaskId ? <Badge tone="violet">Escalated</Badge> : ''), muted: true },
      ]}
      detail={(rec, _c, api) => (
        <div className="space-y-4">
          <Escalate rec={rec} api={api} />
          <AiAssist task="reply_ticket" id={rec.id} label="Suggest a reply with FlowAi" />
        </div>
      )}
    />
  );
}

/* ─────────────────────────────── Feature requests ─────────────────────────────── */

function useVotes() {
  const [votes, setVotes] = useState<{ id: string; requestId: string; accountId: string | null; userId: string | null; note: string }[]>([]);
  const load = useCallback(() => suiteApi<typeof votes>('/api/suite/votes').then(setVotes).catch(() => {}), []);
  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(['suite'], () => void load());
  return { votes, reload: load };
}

function Requests() {
  const toast = useToast();
  const accounts = useRecords<Rec>('accounts', {}, { limit: 100 });
  const products = useRecords<Rec>('products', {}, { limit: 100 });
  const releases = useRecords<Rec>('releases', {}, { limit: 100 });
  const { votes, reload } = useVotes();
  const byRequest = useMemo(() => {
    const m = new Map<string, typeof votes>();
    for (const v of votes) m.set(v.requestId, [...(m.get(v.requestId) ?? []), v]);
    return m;
  }, [votes]);
  const revenue = (id: string) => {
    const ids = new Set((byRequest.get(id) ?? []).map(v => v.accountId).filter(Boolean));
    return accounts.items.filter(a => ids.has(a.id)).reduce((s, a) => s + (a.mrrCents || 0), 0);
  };
  const fields: FieldDef[] = [
    { name: 'title', label: 'Request', required: true },
    { name: 'description', label: 'Details', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['open', 'planned', 'in_progress', 'shipped', 'declined'], { in_progress: 'In progress' }), half: true },
    { name: 'productId', label: 'Product', type: 'select', options: products.items.map(p => ({ value: p.id, label: String(p.name) })), half: true },
    { name: 'releaseId', label: 'Delivered in release', type: 'select', options: releases.items.map(r => ({ value: r.id, label: String(r.version) })), hint: 'When that release ships, the request is marked shipped automatically.' },
  ];

  function Votes({ rec }: { rec: Rec }) {
    const [accountId, setAccountId] = useState('');
    const list = byRequest.get(rec.id) ?? [];
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-neutral-700">Who asked ({list.length})</p>
        <ul className="text-[12.5px] space-y-1">
          {list.map(v => (
            <li key={v.id}>{v.accountId ? accounts.items.find(a => a.id === v.accountId)?.name ?? 'Customer' : 'Team member'}{v.note ? ` — ${v.note}` : ''}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Select value={accountId} onChange={e => setAccountId(e.target.value)} options={accounts.items.map(a => ({ value: a.id, label: String(a.name) }))} placeholder="Myself" aria-label="Customer" />
          <Button onClick={() => suiteApi('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action: 'request.vote', requestId: rec.id, accountId: accountId || null }) }).then(() => { toast.success('Vote added'); void reload(); }).catch(e => toast.error((e as Error).message))}>Add vote</Button>
        </div>
      </div>
    );
  }

  return (
    <RecordsTab
      entity="requests"
      noun="Feature request"
      fields={fields}
      defaults={{ status: 'open' }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['open', 'planned', 'in_progress', 'shipped', 'declined'], { in_progress: 'In progress' }) }]}
      empty={{ title: 'No feature requests yet', hint: 'Record what customers ask for. Votes and revenue show product managers what matters most.' }}
      columns={[
        { head: 'Request', render: r => <span className="font-medium">{r.title}</span> },
        { head: 'Votes', render: r => (byRequest.get(r.id) ?? []).length },
        { head: 'Revenue asking', render: r => money(revenue(r.id)) },
        { head: 'Status', render: r => <Badge tone={REQUEST_TONE[r.status]}>{String(r.status).replace('_', ' ')}</Badge> },
        { head: 'Release', render: r => releases.items.find(x => x.id === r.releaseId)?.version ?? '—', muted: true },
      ]}
      detail={rec => <Votes rec={rec} />}
    />
  );
}

/* ─────────────────────────────── Feedback ─────────────────────────────── */

function Feedback() {
  const accounts = useRecords<Rec>('accounts', {}, { limit: 100 });
  return (
    <RecordsTab
      entity="nps"
      noun="Response"
      search={false}
      fields={[
        { name: 'accountId', label: 'Customer', type: 'select', options: accounts.items.map(a => ({ value: a.id, label: String(a.name) })), half: true },
        { name: 'score', label: 'Score (0–10)', type: 'number', required: true, half: true, hint: '“How likely are you to recommend us?”' },
        { name: 'comment', label: 'Comment', type: 'textarea' },
      ]}
      defaults={{ score: 9 }}
      header={items => {
        const p = items.filter(n => n.score >= 9).length;
        const d = items.filter(n => n.score <= 6).length;
        return (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat label="NPS" value={items.length ? Math.round(((p - d) / items.length) * 100) : '—'} hint="Promoters minus detractors" />
            <Stat label="Promoters (9–10)" value={p} tone="good" />
            <Stat label="Detractors (0–6)" value={d} tone={d ? 'bad' : undefined} />
          </div>
        );
      }}
      empty={{ title: 'No feedback yet', hint: 'Record NPS answers from customers to track how they feel over time.' }}
      columns={[
        { head: 'Score', render: r => <Badge tone={r.score >= 9 ? 'green' : r.score <= 6 ? 'red' : 'amber'}>{r.score}</Badge> },
        { head: 'Customer', render: r => accounts.items.find(a => a.id === r.accountId)?.name ?? '—' },
        { head: 'Comment', render: r => <span className="line-clamp-1">{r.comment || '—'}</span>, muted: true },
        { head: 'When', render: r => ago(r.createdAt), muted: true },
      ]}
    />
  );
}

/* ─────────────────────────────── Client work ─────────────────────────────── */

function PortalLink({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [state, setState] = useState<{ enabled: boolean; url?: string } | null>(null);
  useEffect(() => {
    setState(null);
    suiteApi<{ enabled: boolean; url?: string }>(`/api/suite/share?kind=client_portal&targetId=${projectId}`).then(setState).catch(() => setState({ enabled: false }));
  }, [projectId]);
  const enable = () => suiteApi<{ enabled: boolean; url: string }>('/api/suite/share', { method: 'POST', body: JSON.stringify({ kind: 'client_portal', targetId: projectId }) }).then(setState).catch(e => toast.error((e as Error).message));
  const disable = () => suiteApi(`/api/suite/share?kind=client_portal&targetId=${projectId}`, { method: 'DELETE' }).then(() => setState({ enabled: false })).catch(e => toast.error((e as Error).message));
  return (
    <div className="border border-[#E5E7EB] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium">Client portal</p>
        <p className="text-[12px] text-neutral-500">A private, read-only page for the client: progress, milestones, change requests and payments. They can approve estimates there.</p>
        {state?.enabled && state.url && <p className="text-[12px] text-[#2563EB] break-all mt-1">{state.url}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        {state?.enabled ? (
          <>
            <Button size="sm" onClick={() => navigator.clipboard?.writeText(state.url || '').then(() => toast.success('Link copied'))}>Copy link</Button>
            <Button size="sm" variant="danger" onClick={disable}>Turn off</Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={enable} disabled={!state}>Create link</Button>
        )}
      </div>
    </div>
  );
}

function ClientWork() {
  const { suite, memberName } = useSuite();
  const [projectId, setProjectId] = useState('');
  const pid = projectId || suite?.projects?.[0]?.id || '';
  const time = useRecords<Rec>('time', { projectId: pid }, { limit: 100, enabled: Boolean(pid) });
  const billableMinutes = time.items.filter(t => t.billable).reduce((s, t) => s + t.minutes, 0);
  const billableValue = time.items.filter(t => t.billable && t.rateCents).reduce((s, t) => s + Math.round((t.minutes / 60) * t.rateCents), 0);

  if (!suite?.projects?.length) return <Empty title="No projects yet" hint="Client work is tracked per project. Win a deal or create a project first." />;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Field label="Client project" className="w-full sm:w-80">
          <Select value={pid} onChange={e => setProjectId(e.target.value)} options={suite.projects.map(p => ({ value: p.id, label: p.name }))} />
        </Field>
      </div>
      <PortalLink projectId={pid} />

      <section>
        <SectionHeader title="Change requests" hint="Extra work the client asks for — estimate it, then the client approves it in the portal." />
        <RecordsTab
          key={`cr-${pid}`}
          entity="changes"
          noun="Change request"
          search={false}
          filters={{ projectId: pid }}
          defaults={{ projectId: pid, status: 'requested' }}
          fields={[
            { name: 'title', label: 'Change', required: true },
            { name: 'description', label: 'Details', type: 'textarea' },
            { name: 'requestedBy', label: 'Requested by', half: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['requested', 'estimated', 'approved', 'rejected']), half: true },
            { name: 'estimateHours', label: 'Estimate (hours)', type: 'number', half: true },
            { name: 'priceCents', label: 'Price', type: 'money', half: true },
          ]}
          empty={{ title: 'No change requests' }}
          columns={[
            { head: 'Change', render: r => r.title },
            { head: 'Estimate', render: r => (r.estimateHours ? `${r.estimateHours} h` : '—'), muted: true },
            { head: 'Price', render: r => money(r.priceCents, r.currency) },
            { head: 'Status', render: r => <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : r.status === 'estimated' ? 'blue' : 'neutral'}>{r.status}</Badge> },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Time" hint={`${Math.round((billableMinutes / 60) * 10) / 10} billable hours${billableValue ? ` · ${money(billableValue)}` : ''}`} />
        <RecordsTab
          key={`time-${pid}`}
          entity="time"
          noun="Time entry"
          search={false}
          filters={{ projectId: pid }}
          defaults={{ projectId: pid, billable: true }}
          fields={[
            { name: 'minutes', label: 'Minutes', type: 'number', required: true, half: true },
            { name: 'date', label: 'Date', type: 'date', half: true },
            { name: 'billable', label: 'Billable', type: 'checkbox', placeholder: 'Bill this time to the client', half: true },
            { name: 'rateCents', label: 'Hourly rate', type: 'money', half: true },
            { name: 'note', label: 'What was done' },
          ]}
          empty={{ title: 'No time logged' }}
          columns={[
            { head: 'Date', render: r => date(r.date) },
            { head: 'Who', render: r => <Person name={memberName(r.userId)} /> },
            { head: 'Time', render: r => `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m` },
            { head: 'Billable', render: r => (r.billable ? 'Yes' : 'No'), muted: true },
            { head: 'Note', render: r => r.note || '—', muted: true },
          ]}
        />
      </section>

      <section>
        <SectionHeader title="Payment milestones" />
        <RecordsTab
          key={`pay-${pid}`}
          entity="payments"
          noun="Milestone"
          search={false}
          filters={{ projectId: pid }}
          defaults={{ projectId: pid, status: 'pending' }}
          fields={[
            { name: 'title', label: 'Milestone', required: true, placeholder: '30% on design sign-off' },
            { name: 'amountCents', label: 'Amount', type: 'money', required: true, half: true },
            { name: 'dueDate', label: 'Due', type: 'date', half: true },
            { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['pending', 'invoiced', 'paid']), half: true },
          ]}
          empty={{ title: 'No payment milestones' }}
          columns={[
            { head: 'Milestone', render: r => r.title },
            { head: 'Amount', render: r => money(r.amountCents, r.currency) },
            { head: 'Due', render: r => date(r.dueDate), muted: true },
            { head: 'Status', render: r => <Badge tone={r.status === 'paid' ? 'green' : r.status === 'invoiced' ? 'blue' : 'neutral'}>{r.status}</Badge> },
          ]}
        />
      </section>
    </div>
  );
}

export default function CustomersHub(_props: { onTaskClick?: (id: string | null) => void }) {
  const { suite } = useSuite();
  const [tab, setTab] = useState('accounts');
  if (suite && !suite.enabled) return <PageShell title="Customers"><Empty title="Not available" /></PageShell>;
  return (
    <PageShell title="Customers" subtitle={suite?.teamName} tabs={TABS} tab={tab} onTab={setTab}>
      {tab === 'accounts' && <Accounts />}
      {tab === 'support' && <Support />}
      {tab === 'requests' && <Requests />}
      {tab === 'feedback' && <Feedback />}
      {tab === 'clients' && <ClientWork />}
    </PageShell>
  );
}
