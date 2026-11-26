'use client';

import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, Field, Person, Select, Textarea, ago, date, type Tone } from '@/components/suite/ui';
import { RecordsTab, opts, type FieldDef, type RecordApi } from '@/components/suite/records';

const SEV_TONE: Record<string, Tone> = { sev1: 'red', sev2: 'amber', sev3: 'neutral', sev4: 'neutral' };
const STATUS_TONE: Record<string, Tone> = { investigating: 'red', identified: 'amber', monitoring: 'blue', resolved: 'green' };
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'What is happening?', required: true },
  { name: 'severity', label: 'Severity', type: 'select', required: true, half: true, options: [
    { value: 'sev1', label: 'SEV1 — outage, all users' },
    { value: 'sev2', label: 'SEV2 — major feature down' },
    { value: 'sev3', label: 'SEV3 — partial / degraded' },
    { value: 'sev4', label: 'SEV4 — minor' },
  ] },
  { name: 'ownerId', label: 'Incident owner', type: 'person', half: true },
  { name: 'summary', label: 'Impact', type: 'textarea', placeholder: 'Who is affected and how?' },
  { name: 'postmortem', label: 'Post-incident review', type: 'textarea', placeholder: 'What happened, why, and what we will change' },
];

function Timeline({ rec, api }: { rec: Rec; api: RecordApi }) {
  const toast = useToast();
  const { memberName } = useSuite();
  const [status, setStatus] = useState(rec.status);
  const [message, setMessage] = useState('');
  const updates = ((rec.updates as { at: string; userId: string; status: string; message: string }[] | null) || []).slice().reverse();

  const post = async () => {
    if (!message.trim()) return toast.error('Write a short update');
    try {
      await suiteApi('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action: 'incident.update', incidentId: rec.id, status, message: message.trim() }) });
      setMessage('');
      toast.success(status === 'resolved' ? 'Incident resolved' : 'Update posted');
      void api.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-neutral-700">Post an update</p>
        <div className="grid grid-cols-3 gap-2">
          <Select value={status} onChange={e => setStatus(e.target.value)} options={opts(STATUSES)} aria-label="Status" />
          <div className="col-span-2">
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What changed?" className="min-h-[60px]" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={post}>Post update</Button>
        </div>
      </div>
      <div>
        <p className="text-[12px] font-medium text-neutral-700 mb-2">Timeline</p>
        <ol className="space-y-3 border-l border-[#E5E7EB] pl-3">
          {updates.map((u, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-white border-2 border-neutral-300" aria-hidden="true" />
              <p className="text-[11.5px] text-neutral-500">
                {date(u.at)} {new Date(u.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {memberName(u.userId)} · <span className="capitalize">{u.status}</span>
              </p>
              <p className="text-[13px] text-[#111111] whitespace-pre-wrap">{u.message}</p>
            </li>
          ))}
          <li className="relative">
            <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-white border-2 border-neutral-300" aria-hidden="true" />
            <p className="text-[11.5px] text-neutral-500">{date(rec.startedAt)} · started</p>
          </li>
        </ol>
      </div>
    </div>
  );
}

function OnCall() {
  const toast = useToast();
  const { suite, memberName } = useSuite();
  const shifts = useRecords<Rec>('oncall', {}, { limit: 50 });
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const now = Date.now();
  const current = shifts.items.filter(s => +new Date(s.startsAt) <= now && +new Date(s.endsAt) >= now);
  const upcoming = shifts.items.filter(s => +new Date(s.startsAt) > now).slice(0, 5);

  const add = async () => {
    if (!who || !from || !to || to < from) return toast.error('Choose a person and a valid date range');
    try {
      await shifts.create({ userId: who, startsAt: new Date(`${from}T00:00:00`).toISOString(), endsAt: new Date(`${to}T23:59:00`).toISOString() });
      setWho('');
      toast.success('On-call shift added');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="border border-[#E5E7EB] rounded-xl p-4 mb-5">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-neutral-500">On call now</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {current.length ? current.map(s => <Person key={s.id} name={memberName(s.userId)} />) : <span className="text-[13px] text-neutral-500">Nobody — add a shift</span>}
          </div>
          {upcoming.length > 0 && (
            <p className="text-[11.5px] text-neutral-500 mt-2">
              Next: {upcoming.map(s => `${memberName(s.userId)} (${date(s.startsAt)})`).join(', ')}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:w-[560px] items-end">
          <Field label="Person"><Select value={who} onChange={e => setWho(e.target.value)} options={(suite?.members || []).map(m => ({ value: m.id, label: m.name }))} placeholder="Choose" /></Field>
          <Field label="From"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full h-8 rounded-lg border border-[#E5E7EB] px-2 text-[13px]" /></Field>
          <Field label="To"><input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full h-8 rounded-lg border border-[#E5E7EB] px-2 text-[13px]" /></Field>
          <Button onClick={add}>Add shift</Button>
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const { memberName } = useSuite();
  const openOnly = useMemo(() => ({}), []);
  return (
    <div>
      <OnCall />
      <RecordsTab
        entity="incidents"
        noun="Incident"
        wide
        fields={FIELDS}
        filters={openOnly}
        defaults={{ severity: 'sev3' }}
        filterBar={[
          { key: 'status', label: 'Statuses', options: opts(STATUSES) },
          { key: 'severity', label: 'Severities', options: ['sev1', 'sev2', 'sev3', 'sev4'].map(s => ({ value: s, label: s.toUpperCase() })) },
        ]}
        empty={{ title: 'No incidents', hint: 'When production breaks, declare an incident here. SEV1 and SEV2 alert whoever is on call.' }}
        columns={[
          { head: 'Severity', render: r => <Badge tone={SEV_TONE[r.severity]}>{String(r.severity).toUpperCase()}</Badge> },
          { head: 'Incident', render: r => <span className="font-medium">{r.title}</span> },
          { head: 'Status', render: r => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
          { head: 'Owner', render: r => <Person name={memberName(r.ownerId)} /> },
          { head: 'Started', render: r => ago(r.startedAt), muted: true },
          { head: 'Duration', render: r => duration(r.startedAt, r.resolvedAt), muted: true },
        ]}
        detail={(rec, _c, api) => <Timeline rec={rec} api={api} />}
      />
    </div>
  );
}

function duration(start: string, end: string | null) {
  const ms = (end ? +new Date(end) : Date.now()) - +new Date(start);
  const m = Math.max(1, Math.round(ms / 60000));
  const text = m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d`;
  return end ? text : `${text} so far`;
}
