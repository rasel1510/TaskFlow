'use client';

/**
 * Sales — pipeline, contacts, activities (follow-ups), proposals and targets.
 */
import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import {
  Badge, Button, Empty, Input, PageShell, Person, ProgressBar, Select, Skeleton, Stat, cx, date, money, type Tone,
} from '@/components/suite/ui';
import { FormFields, RecordsTab, fromForm, opts, toForm, type FieldDef } from '@/components/suite/records';
import { Drawer, ConfirmButton } from '@/components/suite/ui';
import AiAssist from '@/components/suite/AiAssist';

const STAGES = ['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation'] as const;
const STAGE_LABEL: Record<string, string> = {
  new: 'New lead', contacted: 'Contacted', qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal sent', negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
};
const STAGE_PROBABILITY: Record<string, number> = { new: 10, contacted: 20, qualified: 35, demo: 50, proposal: 65, negotiation: 80 };
const SOURCES = ['website', 'referral', 'linkedin', 'facebook', 'event', 'cold_call', 'campaign', 'other'];
const SOURCE_LABEL: Record<string, string> = { linkedin: 'LinkedIn', cold_call: 'Cold call' };
const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'activities', label: 'Follow-ups' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'targets', label: 'Targets' },
];

/* ─────────────────────────────── Pipeline ─────────────────────────────── */

function DealDrawer({ deal, contacts, products, onClose, onChanged, onOpenProject }: {
  deal: Rec | 'new' | null; contacts: Rec[]; products: Rec[]; onClose: () => void; onChanged: () => void; onOpenProject?: (id: string) => void;
}) {
  const toast = useToast();
  const isNew = deal === 'new';
  const fields: FieldDef[] = useMemo(() => [
    { name: 'title', label: 'Deal', required: true, placeholder: 'Website rebuild for Acme' },
    { name: 'companyName', label: 'Company', half: true },
    { name: 'contactId', label: 'Contact', type: 'select', options: contacts.map(c => ({ value: c.id, label: `${c.name}${c.companyName ? ` · ${c.companyName}` : ''}` })), half: true },
    { name: 'valueCents', label: 'Value', type: 'money', half: true },
    { name: 'currency', label: 'Currency', type: 'select', required: true, options: opts(['USD', 'EUR', 'GBP', 'BDT', 'INR']), half: true },
    { name: 'stage', label: 'Stage', type: 'select', required: true, options: STAGES.map(s => ({ value: s, label: STAGE_LABEL[s] })), half: true },
    { name: 'expectedCloseAt', label: 'Expected close', type: 'date', half: true },
    { name: 'ownerId', label: 'Owner', type: 'person', half: true },
    { name: 'productId', label: 'Product / service', type: 'select', options: products.map(p => ({ value: p.id, label: String(p.name) })), half: true },
    { name: 'source', label: 'Source', type: 'select', required: true, options: opts(SOURCES, SOURCE_LABEL), half: true },
    { name: 'nextStep', label: 'Next step', placeholder: 'Send proposal by Friday', half: true },
    { name: 'requirements', label: 'Agreed requirements', type: 'textarea', hint: 'One per line — they become backlog stories when the deal is won.' },
  ], [contacts, products]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const key = deal === 'new' ? 'new' : deal?.id;
  React.useEffect(() => {
    if (!deal) return;
    setValues(toForm(fields, deal === 'new' ? null : deal, { stage: 'new', currency: 'USD', source: 'other' }));
    setLostReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = async () => {
    setSaving(true);
    try {
      const data = fromForm(fields, values);
      if (!isNew && deal && data.stage !== deal.stage) data.probability = STAGE_PROBABILITY[String(data.stage)] ?? deal.probability;
      if (isNew) data.probability = STAGE_PROBABILITY[String(data.stage)] ?? 10;
      await suiteApi(isNew ? '/api/suite/deals' : `/api/suite/deals/${(deal as Rec).id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(data) });
      toast.success(isNew ? 'Deal added' : 'Deal saved');
      onChanged();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (action: 'deal.won' | 'deal.lost') => {
    if (!deal || deal === 'new') return;
    try {
      const res = await suiteApi<{ projectId?: string; backlog?: number }>('/api/suite/actions', { method: 'POST', body: JSON.stringify({ action, dealId: deal.id, ...(action === 'deal.lost' ? { reason: lostReason } : {}) }) });
      toast.success(action === 'deal.won' ? `Deal won${res.projectId ? ` — client project created${res.backlog ? ` with ${res.backlog} backlog items` : ''}` : ''}` : 'Marked as lost');
      onChanged();
      onClose();
      if (action === 'deal.won' && res.projectId && onOpenProject) onOpenProject(res.projectId);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const del = async () => {
    if (!deal || deal === 'new') return;
    try {
      await suiteApi(`/api/suite/deals/${deal.id}`, { method: 'DELETE' });
      onChanged();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const closed = deal && deal !== 'new' && (deal.stage === 'won' || deal.stage === 'lost');

  return (
    <Drawer
      open={Boolean(deal)}
      wide
      title={isNew ? 'New deal' : (deal as Rec | null)?.title ?? ''}
      onClose={onClose}
      footer={
        <>
          <div>{!isNew && <ConfirmButton onConfirm={del} />}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add deal' : 'Save'}</Button>
          </div>
        </>
      }
    >
      {closed && (
        <div className={cx('rounded-lg px-3 py-2 text-[12.5px]', (deal as Rec).stage === 'won' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-50 text-neutral-700')}>
          {(deal as Rec).stage === 'won' ? `Won ${date((deal as Rec).wonAt, true)}` : `Lost ${date((deal as Rec).lostAt, true)}${(deal as Rec).lostReason ? ` — ${(deal as Rec).lostReason}` : ''}`}
          {(deal as Rec).projectId && onOpenProject && (
            <button type="button" className="ml-2 underline cursor-pointer" onClick={() => onOpenProject((deal as Rec).projectId)}>Open client project</button>
          )}
        </div>
      )}
      <FormFields fields={fields} values={values} onChange={(n, v) => setValues(s => ({ ...s, [n]: v }))} />
      {!isNew && deal && !closed && (
        <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
          <p className="text-[12px] font-medium text-neutral-700">Close the deal</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="primary" onClick={() => act('deal.won')}>Mark as won</Button>
            <Input value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was it lost? (price, timing, competitor…)" />
            <Button onClick={() => act('deal.lost')}>Mark as lost</Button>
          </div>
          <p className="text-[11.5px] text-neutral-400">Winning creates the client project, its backlog and a customer account automatically.</p>
        </div>
      )}
      {!isNew && deal && <DealActivities dealId={(deal as Rec).id} />}
      {!isNew && deal && <div className="pt-3 border-t border-[#E5E7EB]"><AiAssist task="summarize_deal" id={(deal as Rec).id} label="Summarize with FlowAi" /></div>}
    </Drawer>
  );
}

function DealActivities({ dealId }: { dealId: string }) {
  const toast = useToast();
  const { memberName } = useSuite();
  const acts = useRecords<Rec>('activities', { dealId }, { limit: 50 });
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('follow_up');
  const [due, setDue] = useState('');
  const add = async () => {
    if (!subject.trim()) return;
    try {
      await acts.create({ dealId, subject: subject.trim(), type, dueAt: due ? new Date(`${due}T09:00:00`).toISOString() : null });
      setSubject('');
      setDue('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="pt-3 border-t border-[#E5E7EB]">
      <p className="text-[12px] font-medium text-neutral-700 mb-2">Activities</p>
      <div className="grid grid-cols-6 gap-2 mb-3">
        <Select className="col-span-2" value={type} onChange={e => setType(e.target.value)} options={opts(['follow_up', 'call', 'meeting', 'email', 'demo', 'note'], { follow_up: 'Follow-up' })} aria-label="Type" />
        <Input className="col-span-4" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Call to discuss the proposal" onKeyDown={e => e.key === 'Enter' && add()} />
        <Input className="col-span-3" type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due date" />
        <Button className="col-span-3" onClick={add}>Add activity</Button>
      </div>
      <ul className="space-y-2">
        {acts.items.map(a => (
          <li key={a.id} className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" checked={Boolean(a.doneAt)} onChange={() => acts.update(a.id, { doneAt: a.doneAt ? null : new Date().toISOString() }).catch(e => toast.error((e as Error).message))} className="mt-0.5 w-4 h-4 accent-[#2563EB]" aria-label="Done" />
            <div className="min-w-0">
              <p className={a.doneAt ? 'line-through text-neutral-400' : ''}>{a.subject}</p>
              <p className="text-[11px] text-neutral-500 capitalize">{String(a.type).replace('_', '-')} · {memberName(a.ownerId)}{a.dueAt ? ` · due ${date(a.dueAt)}` : ''}</p>
            </div>
          </li>
        ))}
        {acts.items.length === 0 && <li className="text-[12px] text-neutral-500">No activities yet.</li>}
      </ul>
    </div>
  );
}

function Pipeline({ onOpenProject }: { onOpenProject?: (id: string) => void }) {
  const toast = useToast();
  const { memberName } = useSuite();
  const [owner, setOwner] = useState('');
  const deals = useRecords<Rec>('deals', { ...(owner ? { ownerId: owner } : {}) }, { limit: 100 });
  const contacts = useRecords<Rec>('contacts', {}, { limit: 100 });
  const products = useRecords<Rec>('products', {}, { limit: 100 });
  const { suite } = useSuite();
  const [open, setOpen] = useState<Rec | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const openDeals = deals.items.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const weighted = openDeals.reduce((s, d) => s + Math.round((d.valueCents * (d.probability ?? 0)) / 100), 0);
  const total = openDeals.reduce((s, d) => s + d.valueCents, 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const wonThisMonth = deals.items.filter(d => d.stage === 'won' && d.wonAt && +new Date(d.wonAt) >= monthStart);
  const closedCount = deals.items.filter(d => d.stage === 'won' || d.stage === 'lost').length;
  const winRate = closedCount ? Math.round((deals.items.filter(d => d.stage === 'won').length / closedCount) * 100) : null;

  const moveTo = async (id: string, stage: string) => {
    const d = deals.items.find(x => x.id === id);
    if (!d || d.stage === stage) return;
    try {
      await deals.update(id, { stage, probability: STAGE_PROBABILITY[stage] ?? d.probability });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Open pipeline" value={money(total)} hint={`${openDeals.length} open deals`} />
        <Stat label="Weighted forecast" value={money(weighted)} hint="Value × chance of winning" />
        <Stat label="Won this month" value={money(wonThisMonth.reduce((s, d) => s + d.valueCents, 0))} hint={`${wonThisMonth.length} deals`} tone="good" />
        <Stat label="Win rate" value={winRate === null ? '—' : `${winRate}%`} hint={`${closedCount} closed deals`} />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Select aria-label="Owner" value={owner} onChange={e => setOwner(e.target.value)} options={(suite?.members || []).map(m => ({ value: m.id, label: m.name }))} placeholder="Everyone's deals" className="sm:w-52" />
        <label className="flex items-center gap-2 text-[12.5px] text-neutral-600 sm:ml-2">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="w-4 h-4 accent-[#2563EB]" /> Show won and lost
        </label>
        <div className="sm:ml-auto"><Button variant="primary" onClick={() => setOpen('new')}>New deal</Button></div>
      </div>
      {deals.loading ? (
        <Skeleton />
      ) : deals.items.length === 0 ? (
        <div className="border border-[#E5E7EB] rounded-xl"><Empty title="No deals yet" hint="Add your first lead. Move it across the board as it progresses; winning it hands the work to engineering." action={<Button variant="primary" onClick={() => setOpen('new')}>New deal</Button>} /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...STAGES, ...(showClosed ? (['won', 'lost'] as const) : [])].map(stage => {
            const list = deals.items.filter(d => d.stage === stage);
            return (
              <div
                key={stage}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId && stage !== 'won' && stage !== 'lost') void moveTo(dragId, stage); setDragId(null); }}
                className="w-64 shrink-0 bg-neutral-50/70 rounded-xl p-2"
              >
                <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                  <span className="text-[12px] font-medium text-neutral-600">{STAGE_LABEL[stage]}</span>
                  <span className="text-[11px] text-neutral-400 tabular-nums">{money(list.reduce((s, d) => s + d.valueCents, 0))}</span>
                </div>
                <div className="space-y-1.5 min-h-[60px]">
                  {list.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      draggable={stage !== 'won' && stage !== 'lost'}
                      onDragStart={() => setDragId(d.id)}
                      onClick={() => setOpen(d)}
                      className="w-full text-left bg-white border border-[#E5E7EB] rounded-lg p-2.5 hover:border-neutral-300 transition-colors duration-150 ease-out cursor-pointer"
                    >
                      <p className="text-[12.5px] font-medium leading-snug line-clamp-2">{d.title}</p>
                      <p className="text-[11.5px] text-neutral-500 mt-0.5 truncate">{d.companyName || '—'}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[12px] tabular-nums">{money(d.valueCents, d.currency)}</span>
                        <span className="text-[11px] text-neutral-400 truncate">{memberName(d.ownerId).split(' ')[0]}</span>
                      </div>
                      {d.nextStep && <p className="text-[11px] text-neutral-500 mt-1 truncate">→ {d.nextStep}</p>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DealDrawer deal={open} contacts={contacts.items} products={products.items} onClose={() => setOpen(null)} onChanged={() => void deals.reload(true)} onOpenProject={onOpenProject} />
    </div>
  );
}

/* ─────────────────────────────── Other tabs ─────────────────────────────── */

/** Minimal CSV parser (quotes, commas and new lines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === String.fromCharCode(10) || ch === String.fromCharCode(13)) {
      if (ch === String.fromCharCode(13) && text[i + 1] === String.fromCharCode(10)) i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

const HEADER_MAP: Record<string, string> = {
  name: 'name', 'full name': 'name', 'contact name': 'name', 'first name': 'first', 'last name': 'last',
  email: 'email', 'email address': 'email', phone: 'phone', 'phone number': 'phone', mobile: 'phone', whatsapp: 'phone',
  company: 'companyName', 'company name': 'companyName', organization: 'companyName', 'job title': 'jobTitle', title: 'jobTitle',
};

function ImportContacts() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File) => {
    if (file.size > 2_000_000) return toast.error('Choose a CSV under 2 MB');
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return toast.error('The file has no rows');
    const head = rows[0].map(h => HEADER_MAP[h.trim().toLowerCase()] ?? '');
    if (!head.includes('name') && !head.includes('first') && !head.includes('email')) return toast.error('Add a header row with Name and Email columns');
    const records = rows.slice(1, 501).map(r => {
      const o: Record<string, string> = {};
      head.forEach((k, i) => { if (k) o[k] = (r[i] || '').trim(); });
      if (!o.name) o.name = [o.first, o.last].filter(Boolean).join(' ') || o.email || '';
      delete o.first; delete o.last;
      return o;
    }).filter(o => o.name);
    setBusy(true);
    try {
      const res = await suiteApi<{ imported: number; duplicates: number; invalid: number }>('/api/suite/import', { method: 'POST', body: JSON.stringify({ rows: records }) });
      toast.success(`${res.imported} imported${res.duplicates ? ` · ${res.duplicates} already existed` : ''}${res.invalid ? ` · ${res.invalid} skipped (invalid)` : ''}`);
      window.dispatchEvent(new CustomEvent('live:suite'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="inline-flex items-center h-8 px-3 rounded-lg border border-[#E5E7EB] text-[13px] font-medium cursor-pointer hover:bg-neutral-50">
      {busy ? 'Importing…' : 'Import CSV'}
      <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f); }} />
    </label>
  );
}

function Contacts() {
  const { memberName } = useSuite();
  const campaigns = useRecords<Rec>('campaigns', {}, { limit: 100, enabled: true });
  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', required: true, half: true },
    { name: 'companyName', label: 'Company', half: true },
    { name: 'jobTitle', label: 'Job title', half: true },
    { name: 'email', label: 'Email', type: 'email', half: true },
    { name: 'phone', label: 'Phone / WhatsApp', half: true },
    { name: 'source', label: 'Source', type: 'select', required: true, options: opts(SOURCES, SOURCE_LABEL), half: true },
    { name: 'campaignId', label: 'From campaign', type: 'select', options: campaigns.items.map(c => ({ value: c.id, label: String(c.name) })), when: v => v.source === 'campaign' },
    { name: 'ownerId', label: 'Owner', type: 'person', half: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return (
    <RecordsTab
      entity="contacts"
      noun="Contact"
      fields={fields}
      defaults={{ source: 'other' }}
      filterBar={[{ key: 'source', label: 'Sources', options: opts(SOURCES, SOURCE_LABEL) }]}
      header={() => (
        <div className="flex items-center justify-end gap-2 mb-3">
          <span className="text-[11.5px] text-neutral-400">Columns: Name, Email, Phone, Company, Job title (HubSpot and Excel exports work)</span>
          <ImportContacts />
        </div>
      )}
      empty={{ title: 'No contacts yet', hint: 'Add the people you sell to, or import a CSV. Their deals and activities stay linked.' }}
      columns={[
        { head: 'Name', render: r => <span className="font-medium">{r.name}</span> },
        { head: 'Company', render: r => r.companyName || '—', muted: true },
        { head: 'Email', render: r => r.email || '—', muted: true },
        { head: 'Phone', render: r => r.phone || '—', muted: true },
        { head: 'Source', render: r => SOURCE_LABEL[r.source] ?? String(r.source).replace('_', ' '), muted: true },
        { head: 'Owner', render: r => <Person name={memberName(r.ownerId)} /> },
      ]}
    />
  );
}

function Activities() {
  const toast = useToast();
  const { suite, memberName } = useSuite();
  const acts = useRecords<Rec>('activities', { ownerId: suite?.me?.id }, { limit: 100, enabled: Boolean(suite?.me?.id) });
  const now = Date.now();
  const open = acts.items.filter(a => !a.doneAt).sort((a, b) => +new Date(a.dueAt || 8.64e15) - +new Date(b.dueAt || 8.64e15));
  const overdue = open.filter(a => a.dueAt && +new Date(a.dueAt) < now);
  return (
    <div>
      <p className="text-[12.5px] text-neutral-500 mb-3">
        Your open follow-ups{overdue.length ? <span className="text-red-600"> · {overdue.length} overdue</span> : ''}. Add new ones from a deal.
      </p>
      {acts.loading ? (
        <Skeleton />
      ) : open.length === 0 ? (
        <div className="border border-[#E5E7EB] rounded-xl"><Empty title="You’re all caught up" hint="Follow-ups you add to deals appear here." /></div>
      ) : (
        <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
          {open.map(a => (
            <li key={a.id} className="px-3 py-2.5 flex items-center gap-3 text-[13px]">
              <input type="checkbox" className="w-4 h-4 accent-[#2563EB]" aria-label="Done" onChange={() => acts.update(a.id, { doneAt: new Date().toISOString() }).catch(e => toast.error((e as Error).message))} />
              <span className="flex-1 min-w-0 truncate">{a.subject}</span>
              <span className="text-[11.5px] text-neutral-500 capitalize shrink-0">{String(a.type).replace('_', '-')}</span>
              <span className={cx('text-[11.5px] shrink-0 tabular-nums', a.dueAt && +new Date(a.dueAt) < now ? 'text-red-600' : 'text-neutral-500')}>{a.dueAt ? date(a.dueAt) : 'No date'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only">{memberName(suite?.me?.id)}</p>
    </div>
  );
}

const PROPOSAL_TONE: Record<string, Tone> = { draft: 'neutral', sent: 'blue', viewed: 'violet', accepted: 'green', declined: 'red' };

function ProposalItems({ rec, api }: { rec: Rec; api: { update: (id: string, d: Record<string, unknown>) => Promise<unknown> } }) {
  const toast = useToast();
  const items = (rec.items as { name: string; qty: number; priceCents: number }[] | null) || [];
  const [row, setRow] = useState({ name: '', qty: '1', price: '' });
  const total = items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const save = (next: typeof items) => api.update(rec.id, { items: next }).catch(e => toast.error((e as Error).message));
  return (
    <div>
      <p className="text-[12px] font-medium text-neutral-700 mb-2">Price breakdown</p>
      <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl mb-2">
        {items.map((i, idx) => (
          <li key={idx} className="px-3 py-2 flex items-center gap-2 text-[12.5px]">
            <span className="flex-1 truncate">{i.name}</span>
            <span className="text-neutral-500 tabular-nums">{i.qty} × {money(i.priceCents, rec.currency)}</span>
            <span className="tabular-nums w-24 text-right">{money(i.qty * i.priceCents, rec.currency)}</span>
            <button type="button" aria-label="Remove line" onClick={() => save(items.filter((_, j) => j !== idx))} className="text-neutral-400 hover:text-red-600 cursor-pointer">×</button>
          </li>
        ))}
        <li className="px-3 py-2 flex justify-between text-[13px] font-medium"><span>Total</span><span className="tabular-nums">{money(total, rec.currency)}</span></li>
      </ul>
      <div className="grid grid-cols-6 gap-2">
        <Input className="col-span-3" value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} placeholder="Design, development, hosting…" />
        <Input className="col-span-1" type="number" min={1} value={row.qty} onChange={e => setRow({ ...row, qty: e.target.value })} aria-label="Quantity" />
        <Input className="col-span-2" type="number" min={0} step="0.01" value={row.price} onChange={e => setRow({ ...row, price: e.target.value })} placeholder="Price" />
      </div>
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={() => {
          if (!row.name.trim() || row.price === '') return;
          void save([...items, { name: row.name.trim(), qty: Math.max(1, Number(row.qty) || 1), priceCents: Math.round(Number(row.price) * 100) }]);
          setRow({ name: '', qty: '1', price: '' });
        }}>Add line</Button>
      </div>
    </div>
  );
}

function Proposals() {
  const deals = useRecords<Rec>('deals', {}, { limit: 100 });
  const fields: FieldDef[] = [
    { name: 'title', label: 'Title', required: true },
    { name: 'dealId', label: 'Deal', type: 'select', options: deals.items.map(d => ({ value: d.id, label: String(d.title) })), half: true },
    { name: 'currency', label: 'Currency', type: 'select', required: true, options: opts(['USD', 'EUR', 'GBP', 'BDT', 'INR']), half: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['draft', 'sent', 'viewed', 'accepted', 'declined']), half: true },
    { name: 'validUntil', label: 'Valid until', type: 'date', half: true },
    { name: 'notes', label: 'Scope and terms', type: 'textarea' },
  ];
  return (
    <RecordsTab
      entity="proposals"
      noun="Proposal"
      wide
      fields={fields}
      defaults={{ currency: 'USD', status: 'draft', items: [] }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['draft', 'sent', 'viewed', 'accepted', 'declined']) }]}
      empty={{ title: 'No proposals yet', hint: 'Write quotations with a clear price breakdown and track whether they were accepted.' }}
      columns={[
        { head: 'Proposal', render: r => <span className="font-medium">{r.title}</span> },
        { head: 'Deal', render: r => deals.items.find(d => d.id === r.dealId)?.title ?? '—', muted: true },
        { head: 'Total', render: r => money(((r.items as { qty: number; priceCents: number }[] | null) || []).reduce((s, i) => s + i.qty * i.priceCents, 0), r.currency) },
        { head: 'Status', render: r => <Badge tone={PROPOSAL_TONE[r.status]}>{r.status}</Badge> },
        { head: 'Valid until', render: r => date(r.validUntil), muted: true },
      ]}
      detail={(rec, _c, api) => <ProposalItems rec={rec} api={api} />}
    />
  );
}

function Targets() {
  const { suite, memberName } = useSuite();
  const targets = useRecords<Rec>('targets', {}, { limit: 100 });
  const won = useRecords<Rec>('deals', { stage: 'won' }, { limit: 100 });
  const achieved = (t: Rec) => {
    const [y, p] = String(t.period).split('-');
    const range = p.startsWith('Q')
      ? [new Date(Number(y), (Number(p[1]) - 1) * 3, 1), new Date(Number(y), Number(p[1]) * 3, 1)]
      : [new Date(Number(y), Number(p) - 1, 1), new Date(Number(y), Number(p), 1)];
    return won.items
      .filter(d => d.wonAt && +new Date(d.wonAt) >= +range[0] && +new Date(d.wonAt) < +range[1] && (!t.userId || d.ownerId === t.userId))
      .reduce((s, d) => s + d.valueCents, 0);
  };
  const now = new Date();
  return (
    <RecordsTab
      entity="targets"
      noun="Target"
      search={false}
      fields={[
        { name: 'period', label: 'Period', required: true, placeholder: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} or ${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`, half: true },
        { name: 'amountCents', label: 'Target amount', type: 'money', required: true, half: true },
        { name: 'userId', label: 'Person', type: 'person', hint: 'Leave empty for the whole sales team.' },
      ]}
      defaults={{ period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }}
      empty={{ title: 'No targets yet', hint: 'Set monthly or quarterly targets per person or for the whole team.' }}
      columns={[
        { head: 'Period', render: r => <span className="font-medium">{r.period}</span> },
        { head: 'Who', render: r => (r.userId ? <Person name={memberName(r.userId)} /> : 'Whole team') },
        { head: 'Target', render: r => money(r.amountCents, r.currency) },
        { head: 'Won', render: r => money(achieved(r), r.currency) },
        {
          head: 'Progress',
          render: r => {
            const pct = r.amountCents ? (achieved(r) / r.amountCents) * 100 : 0;
            return (
              <div className="w-32 flex items-center gap-2">
                <div className="flex-1"><ProgressBar value={pct} tone={pct >= 100 ? 'green' : 'blue'} /></div>
                <span className="text-[11.5px] text-neutral-500 tabular-nums">{Math.round(pct)}%</span>
              </div>
            );
          },
        },
      ]}
      header={() => (suite?.me?.isManager ? null : <p className="text-[12px] text-neutral-500 mb-3">Targets are usually set by the sales manager.</p>)}
    />
  );
}

export default function SalesHub({ onOpenProject }: { onOpenProject?: (id: string) => void }) {
  const { suite } = useSuite();
  const [tab, setTab] = useState('pipeline');
  if (suite && !suite.enabled) return <PageShell title="Sales"><Empty title="Not available" /></PageShell>;
  return (
    <PageShell title="Sales" subtitle={suite?.teamName} tabs={TABS} tab={tab} onTab={setTab}>
      {tab === 'pipeline' && <Pipeline onOpenProject={onOpenProject} />}
      {tab === 'contacts' && <Contacts />}
      {tab === 'activities' && <Activities />}
      {tab === 'proposals' && <Proposals />}
      {tab === 'targets' && <Targets />}
    </PageShell>
  );
}

