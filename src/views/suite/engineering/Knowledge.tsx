'use client';

/**
 * Engineering → Docs (wiki and templates), QA (test cases and runs) and Infrastructure (assets).
 */
import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, Cell, Empty, Field, Input, Person, Row, SectionHeader, Select, Skeleton, Stat, Table, ago, date, money, type Tone } from '@/components/suite/ui';
import { RecordsTab, opts, type FieldDef } from '@/components/suite/records';
import AiAssist from '@/components/suite/AiAssist';

function StoriesFromDoc({ docId }: { docId: string }) {
  const { suite } = useSuite();
  const [projectId, setProjectId] = useState(suite?.projects?.[0]?.id ?? '');
  return (
    <div className="space-y-2 pt-3 border-t border-[#E5E7EB]">
      <p className="text-[12px] font-medium text-neutral-700">Turn into backlog stories</p>
      <Select value={projectId} onChange={e => setProjectId(e.target.value)} options={(suite?.projects || []).map(p => ({ value: p.id, label: p.name }))} placeholder="Choose project" aria-label="Project" />
      <AiAssist task="stories_from_doc" id={docId} label="Create stories with FlowAi" extra={{ projectId }} disabled={!projectId} hint="Added to the backlog" />
    </div>
  );
}

/* ─────────────────────────────── Docs ─────────────────────────────── */

const DOC_KINDS: Record<string, string> = {
  wiki: 'Wiki page', prd: 'Requirements (PRD)', tech_spec: 'Technical design', decision: 'Decision record', runbook: 'Runbook', meeting: 'Meeting notes',
};

const TEMPLATES: Record<string, string> = {
  prd: '## Problem\n\n## Goals\n\n## Users and use cases\n\n## Requirements\n- \n\n## Out of scope\n\n## Success metrics\n',
  tech_spec: '## Summary\n\n## Background\n\n## Proposed design\n\n## Alternatives considered\n\n## Risks and rollout plan\n\n## Open questions\n',
  decision: '## Context\n\n## Decision\n\n## Options considered\n\n## Consequences\n',
  runbook: '## When to use this\n\n## Symptoms\n\n## Steps\n1. \n\n## How to verify\n\n## Escalation\n',
  meeting: '## Attendees\n\n## Agenda\n\n## Notes\n\n## Action items\n- [ ] \n',
};

const DOC_STATUS_TONE: Record<string, Tone> = { draft: 'neutral', in_review: 'amber', approved: 'green' };

export function Docs() {
  const toast = useToast();
  const { memberName, suite } = useSuite();
  const products = useRecords<Rec>('products', {}, { limit: 100 });
  const productOpts = useMemo(() => products.items.map(p => ({ value: p.id, label: String(p.name) })), [products.items]);
  const docs = useRecords<Rec>('docs', {}, { enabled: false });

  const fields: FieldDef[] = [
    { name: 'title', label: 'Title', required: true },
    { name: 'kind', label: 'Kind', type: 'select', required: true, options: Object.entries(DOC_KINDS).map(([value, label]) => ({ value, label })), half: true },
    { name: 'productId', label: 'Product', type: 'select', options: productOpts, half: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['draft', 'in_review'], { in_review: 'Ready for review' }), half: true },
    { name: 'body', label: 'Content', type: 'textarea', placeholder: 'Write in plain text or Markdown' },
  ];

  const fromTemplate = async (kind: string) => {
    try {
      await docs.create({ title: `New ${DOC_KINDS[kind].toLowerCase()}`, kind, body: TEMPLATES[kind], status: 'draft' });
      toast.success('Created from template — open it to edit');
      window.dispatchEvent(new CustomEvent('live:suite'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <RecordsTab
      entity="docs"
      noun="Document"
      wide
      fields={fields}
      defaults={{ kind: 'wiki', status: 'draft' }}
      filterBar={[{ key: 'kind', label: 'Kinds', options: Object.entries(DOC_KINDS).map(([value, label]) => ({ value, label })) }, { key: 'status', label: 'Statuses', options: opts(['draft', 'in_review', 'approved']) }]}
      header={() => (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[12px] text-neutral-500 mr-1">Start from a template:</span>
          {Object.keys(TEMPLATES).map(k => (
            <Button key={k} size="sm" variant="ghost" onClick={() => fromTemplate(k)}>{DOC_KINDS[k]}</Button>
          ))}
        </div>
      )}
      empty={{ title: 'No documents yet', hint: 'Keep requirements, technical designs, decisions and runbooks next to the work.' }}
      columns={[
        { head: 'Title', render: r => <span className="font-medium">{r.title}</span> },
        { head: 'Kind', render: r => DOC_KINDS[r.kind] ?? r.kind, muted: true },
        { head: 'Status', render: r => <Badge tone={DOC_STATUS_TONE[r.status]}>{r.status === 'in_review' ? 'In review' : r.status}</Badge> },
        { head: 'Author', render: r => <Person name={memberName(r.authorId)} /> },
        { head: 'Updated', render: r => ago(r.updatedAt), muted: true },
      ]}
      detail={(rec, _c, api) => (
        <div className="space-y-3">
        {rec.status === 'approved' ? (
          <p className="text-[12.5px] text-neutral-500">Approved by {memberName(rec.approvedById)} on {date(rec.approvedAt, true)}.</p>
        ) : rec.authorId !== suite?.me?.id || suite?.me?.isManager ? (
          <Button
            onClick={() =>
              suiteApi('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action: 'doc.approve', docId: rec.id }) })
                .then(() => { toast.success('Approved'); void api.reload(true); })
                .catch(e => toast.error((e as Error).message))
            }
          >
            Approve document
          </Button>
        ) : (
          <p className="text-[12.5px] text-neutral-500">Set the status to “Ready for review” and ask a teammate to approve it.</p>
        )}
        {(rec.kind === 'prd' || rec.kind === 'tech_spec' || rec.kind === 'wiki') && <StoriesFromDoc docId={rec.id} />}
        </div>
      )}
    />
  );
}

/* ─────────────────────────────── QA ─────────────────────────────── */

const RESULT_TONE: Record<string, Tone> = { pass: 'green', fail: 'red', blocked: 'amber', untested: 'neutral' };

export function QA() {
  const toast = useToast();
  const cases = useRecords<Rec>('testcases', {}, { limit: 100 });
  const runs = useRecords<Rec>('testruns', {}, { limit: 50 });
  const releases = useRecords<Rec>('releases', {}, { limit: 100 });
  const [runId, setRunId] = useState('');
  const [newRun, setNewRun] = useState({ name: '', releaseId: '' });
  const run = runs.items.find(r => r.id === runId) ?? runs.items[0];
  const results = (run?.results as Record<string, string> | null) || {};
  const counts = cases.items.reduce<Record<string, number>>((acc, c) => {
    const r = results[c.id] || 'untested';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  const setResult = (caseId: string, value: string) => {
    if (!run) return;
    runs.update(run.id, { results: { ...results, [caseId]: value } }).catch(e => toast.error((e as Error).message));
  };

  const createRun = async () => {
    if (!newRun.name.trim()) return toast.error('Name the test run');
    try {
      const created = await runs.create({ name: newRun.name.trim(), releaseId: newRun.releaseId || null, results: {} });
      setRunId(created.id);
      setNewRun({ name: '', releaseId: '' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const signOff = async () => {
    if (!run) return;
    try {
      await suiteApi('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action: 'testrun.signoff', testRunId: run.id }) });
      toast.success(run.releaseId ? 'Signed off — the release has QA approval' : 'Signed off');
      void runs.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader title="Test runs" hint="Run the test cases for a release and record pass / fail / blocked." />
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          {runs.items.length > 0 && (
            <Select aria-label="Test run" value={run?.id ?? ''} onChange={e => setRunId(e.target.value)} options={runs.items.map(r => ({ value: r.id, label: `${r.name}${r.status === 'signed_off' ? ' · signed off' : ''}` }))} className="sm:w-64" />
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Input value={newRun.name} onChange={e => setNewRun({ ...newRun, name: e.target.value })} placeholder="New run, e.g. v2.4 regression" className="sm:w-56" />
            <Select aria-label="Release" value={newRun.releaseId} onChange={e => setNewRun({ ...newRun, releaseId: e.target.value })} options={releases.items.map(r => ({ value: r.id, label: String(r.version) }))} placeholder="No release" className="sm:w-36" />
            <Button variant="primary" onClick={createRun}>Start run</Button>
          </div>
        </div>
        {runs.loading || cases.loading ? (
          <Skeleton />
        ) : !run ? (
          <div className="border border-[#E5E7EB] rounded-xl"><Empty title="No test runs yet" hint="Add test cases below, then start a run." /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {(['pass', 'fail', 'blocked', 'untested'] as const).map(k => (
                <Badge key={k} tone={RESULT_TONE[k]}>{counts[k] || 0} {k}</Badge>
              ))}
              <span className="ml-auto">
                {run.status === 'signed_off' ? <Badge tone="green">Signed off {date(run.signedOffAt)}</Badge> : <Button size="sm" onClick={signOff}>Sign off</Button>}
              </span>
            </div>
            <Table head={['Test case', 'Priority', 'Result']} empty={<Empty title="No test cases" hint="Add test cases below." />}>
              {cases.items.map(c => (
                <Row key={c.id}>
                  <Cell>{c.title}</Cell>
                  <Cell muted className="capitalize">{c.priority}</Cell>
                  <Cell>
                    <div className="flex gap-1">
                      {(['pass', 'fail', 'blocked'] as const).map(k => (
                        <button
                          key={k}
                          type="button"
                          disabled={run.status === 'signed_off'}
                          onClick={() => setResult(c.id, results[c.id] === k ? 'untested' : k)}
                          className={`h-6 px-2 rounded-md text-[11.5px] border cursor-pointer disabled:cursor-default ${results[c.id] === k ? (k === 'pass' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : k === 'fail' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700') : 'border-[#E5E7EB] text-neutral-500 hover:bg-neutral-50'}`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          </>
        )}
      </section>

      <section>
        <SectionHeader title="Test cases" />
        <RecordsTab
          entity="testcases"
          noun="Test case"
          fields={[
            { name: 'title', label: 'Title', required: true },
            { name: 'priority', label: 'Priority', type: 'select', required: true, options: opts(['low', 'medium', 'high']), half: true },
            { name: 'steps', label: 'Steps', type: 'textarea', placeholder: '1. …' },
            { name: 'expected', label: 'Expected result', type: 'textarea' },
          ]}
          defaults={{ priority: 'medium' }}
          empty={{ title: 'No test cases yet', hint: 'Write the checks that must pass before every release.' }}
          columns={[
            { head: 'Test case', render: r => r.title },
            { head: 'Priority', render: r => <span className="capitalize">{r.priority}</span>, muted: true },
            { head: 'Added', render: r => ago(r.createdAt), muted: true },
          ]}
        />
      </section>
    </div>
  );
}

/* ─────────────────────────────── Infrastructure ─────────────────────────────── */

const CATEGORY_LABEL: Record<string, string> = { domain: 'Domain', service: 'Cloud service', tool: 'Paid tool', license: 'License', secret: 'Secret (name only)' };

export function Infrastructure() {
  const { memberName } = useSuite();
  const fields: FieldDef[] = [
    { name: 'category', label: 'Category', type: 'select', required: true, options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })), half: true },
    { name: 'name', label: 'Name', required: true, placeholder: 'flowsync.com, Neon database, STRIPE_SECRET_KEY…', half: true },
    { name: 'provider', label: 'Provider', placeholder: 'Namecheap, Neon, Vercel…', half: true },
    { name: 'ownerId', label: 'Owner', type: 'person', half: true },
    { name: 'location', label: 'Where the value is kept', placeholder: 'Vercel env, GitHub secrets…', when: v => v.category === 'secret', hint: 'Never paste the secret itself — only where it lives.' },
    { name: 'lastRotatedAt', label: 'Last changed', type: 'date', half: true, when: v => v.category === 'secret' },
    { name: 'costCents', label: 'Cost', type: 'money', half: true, when: v => v.category !== 'secret' },
    { name: 'billingCycle', label: 'Billed', type: 'select', options: opts(['monthly', 'yearly', 'one_time'], { one_time: 'One time' }), half: true, when: v => v.category !== 'secret' },
    { name: 'renewsAt', label: 'Renews on', type: 'date', half: true, when: v => v.category !== 'secret' },
    { name: 'expiresAt', label: 'Expires on', type: 'date', half: true, hint: 'Domains and SSL certificates' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <RecordsTab
      entity="assets"
      noun="Asset"
      fields={fields}
      defaults={{ category: 'service', billingCycle: 'monthly' }}
      filterBar={[{ key: 'category', label: 'Categories', options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })) }]}
      header={items => {
        const monthly = items.reduce((s, a) => s + (a.costCents ? (a.billingCycle === 'yearly' ? a.costCents / 12 : a.billingCycle === 'monthly' ? a.costCents : 0) : 0), 0);
        const soon = items.filter(a => {
          const d = a.expiresAt || a.renewsAt;
          return d && +new Date(d) - Date.now() < 30 * 86400000;
        });
        const stale = items.filter(a => a.category === 'secret' && (!a.lastRotatedAt || Date.now() - +new Date(a.lastRotatedAt) > 180 * 86400000));
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Stat label="Monthly spend" value={money(Math.round(monthly))} hint="Services, tools and licenses" />
            <Stat label="Renewing or expiring in 30 days" value={soon.length} tone={soon.length ? 'bad' : undefined} hint={soon.slice(0, 2).map(a => a.name).join(', ') || 'Nothing soon'} />
            <Stat label="Secrets not changed in 6 months" value={stale.length} tone={stale.length ? 'bad' : undefined} hint={stale.length ? 'Plan a rotation' : 'All recent'} />
          </div>
        );
      }}
      empty={{ title: 'Nothing tracked yet', hint: 'List domains, cloud services, paid tools, licenses and where each secret is kept — so nothing expires by surprise.' }}
      columns={[
        { head: 'Name', render: r => <span className="font-medium">{r.name}</span> },
        { head: 'Category', render: r => CATEGORY_LABEL[r.category] ?? r.category, muted: true },
        { head: 'Provider', render: r => r.provider || '—', muted: true },
        { head: 'Owner', render: r => <Person name={memberName(r.ownerId)} /> },
        { head: 'Cost', render: r => (r.costCents ? `${money(r.costCents, r.currency)} / ${r.billingCycle === 'yearly' ? 'yr' : r.billingCycle === 'monthly' ? 'mo' : 'once'}` : '—'), muted: true },
        { head: 'Renews / expires', render: r => date(r.expiresAt || r.renewsAt), muted: true },
      ]}
    />
  );
}
