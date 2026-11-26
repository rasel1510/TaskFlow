'use client';

/**
 * Marketing — campaigns (with lead attribution), content calendar (incl. release launch
 * checklists) and the brand kit.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useLiveRefresh } from '@/lib/liveSync';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, Empty, PageShell, Person, Skeleton, Stat, cx, date, money, type Tone } from '@/components/suite/ui';
import { FormFields, RecordsTab, fromForm, opts, toForm, type FieldDef } from '@/components/suite/records';
import { ConfirmButton, Drawer } from '@/components/suite/ui';
import AiAssist from '@/components/suite/AiAssist';

const TABS = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'content', label: 'Content' },
  { id: 'brand', label: 'Brand kit' },
];
const CHANNELS = ['google_ads', 'meta_ads', 'linkedin', 'seo', 'email', 'social', 'events', 'content'];
const CHANNEL_LABEL: Record<string, string> = { google_ads: 'Google Ads', meta_ads: 'Meta Ads', linkedin: 'LinkedIn', seo: 'SEO' };
const STAGES = ['idea', 'writing', 'design', 'review', 'scheduled', 'published'];
const CONTENT_CHANNELS = ['blog', 'social', 'email', 'video', 'newsletter', 'website', 'announcement'];
const STATUS_TONE: Record<string, Tone> = { planned: 'neutral', active: 'blue', completed: 'green' };

/* ─────────────────────────────── Campaigns ─────────────────────────────── */

function Campaigns() {
  const { memberName } = useSuite();
  // Leads and revenue per campaign are worked out on the server (marketing can't open Sales data)
  const [attr, setAttr] = useState<Record<string, { leads: number; wonCents: number }>>({});
  const loadAttr = () =>
    suiteApi<{ perCampaign: { id: string; leads: number; wonCents: number }[] }>('/api/suite/metrics?section=marketing')
      .then(m => setAttr(Object.fromEntries(m.perCampaign.map(c => [c.id, c]))))
      .catch(() => {});
  useEffect(() => {
    void loadAttr();
  }, []);
  useLiveRefresh(['suite'], () => void loadAttr());
  const leadsFor = (id: string) => attr[id]?.leads ?? 0;
  const wonFor = (id: string) => attr[id]?.wonCents ?? 0;

  const fields: FieldDef[] = [
    { name: 'name', label: 'Campaign', required: true },
    { name: 'goal', label: 'Goal', placeholder: '50 qualified leads for the new plan' },
    { name: 'channels', label: 'Channels', type: 'tags', placeholder: 'Google Ads, LinkedIn, Email' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: opts(['planned', 'active', 'completed']), half: true },
    { name: 'ownerId', label: 'Owner', type: 'person', half: true },
    { name: 'startDate', label: 'Start', type: 'date', half: true },
    { name: 'endDate', label: 'End', type: 'date', half: true },
    { name: 'budgetCents', label: 'Budget', type: 'money', half: true },
    { name: 'spentCents', label: 'Spent so far', type: 'money', half: true },
    { name: 'clicks', label: 'Clicks', type: 'number', half: true },
    { name: 'notes', label: 'Notes and results', type: 'textarea' },
  ];

  return (
    <RecordsTab
      entity="campaigns"
      noun="Campaign"
      fields={fields}
      defaults={{ status: 'planned' }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['planned', 'active', 'completed']) }]}
      header={items => {
        const spent = items.reduce((s, c) => s + (c.spentCents || 0), 0);
        const leads = items.reduce((s, c) => s + leadsFor(c.id), 0);
        const won = items.reduce((s, c) => s + wonFor(c.id), 0);
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Stat label="Active campaigns" value={items.filter(c => c.status === 'active').length} />
            <Stat label="Spent" value={money(spent)} />
            <Stat label="Leads from campaigns" value={leads} hint={leads ? `${money(Math.round(spent / leads))} per lead` : 'Tag contacts with their campaign'} />
            <Stat label="Won from campaigns" value={money(won)} tone={won ? 'good' : undefined} hint={spent ? `${(won / spent).toFixed(1)}× return` : undefined} />
          </div>
        );
      }}
      empty={{ title: 'No campaigns yet', hint: 'Plan a campaign, then tag the leads it brings in (Sales → Contacts → source “Campaign”) to see cost per lead and revenue.' }}
      columns={[
        { head: 'Campaign', render: r => <span className="font-medium">{r.name}</span> },
        { head: 'Status', render: r => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
        { head: 'Channels', render: r => ((r.channels as string[]) || []).join(', ') || '—', muted: true },
        { head: 'Spent / budget', render: r => `${money(r.spentCents)} / ${money(r.budgetCents)}`, muted: true },
        { head: 'Leads', render: r => leadsFor(r.id) },
        { head: 'Won', render: r => money(wonFor(r.id)) },
        { head: 'Owner', render: r => <Person name={memberName(r.ownerId)} /> },
      ]}
    />
  );
}

/* ─────────────────────────────── Content ─────────────────────────────── */

function Content() {
  const toast = useToast();
  const { memberName } = useSuite();
  const content = useRecords<Rec>('content', {}, { limit: 100 });
  const campaigns = useRecords<Rec>('campaigns', {}, { limit: 100 });
  const [editing, setEditing] = useState<Rec | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);

  const fields: FieldDef[] = useMemo(() => [
    { name: 'title', label: 'Title', required: true },
    { name: 'channel', label: 'Channel', type: 'select', required: true, options: opts(CONTENT_CHANNELS), half: true },
    { name: 'stage', label: 'Stage', type: 'select', required: true, options: opts(STAGES), half: true },
    { name: 'publishAt', label: 'Publish on', type: 'date', half: true },
    { name: 'ownerId', label: 'Owner', type: 'person', half: true },
    { name: 'campaignId', label: 'Campaign', type: 'select', options: campaigns.items.map(c => ({ value: c.id, label: String(c.name) })), half: true },
    { name: 'url', label: 'Published link', half: true },
    { name: 'notes', label: 'Brief / draft', type: 'textarea' },
  ], [campaigns.items]);

  const open = (rec: Rec | 'new') => {
    setEditing(rec);
    setValues(toForm(fields, rec === 'new' ? null : rec, { channel: 'blog', stage: 'idea' }));
  };
  const save = async () => {
    try {
      const data = fromForm(fields, values);
      if (editing === 'new') await content.create(data);
      else if (editing) await content.update(editing.id, data);
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const upcoming = content.items.filter(c => c.publishAt && c.stage !== 'published').sort((a, b) => +new Date(a.publishAt) - +new Date(b.publishAt)).slice(0, 6);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[12.5px] text-neutral-500">Releasing a version adds its launch checklist here automatically.</p>
        <Button variant="primary" onClick={() => open('new')}>New content</Button>
      </div>
      {upcoming.length > 0 && (
        <div className="border border-[#E5E7EB] rounded-xl px-4 py-3 mb-4">
          <p className="text-[12px] font-medium text-neutral-700 mb-1.5">Coming up</p>
          <ul className="space-y-1">
            {upcoming.map(c => (
              <li key={c.id} className="text-[12.5px] flex items-center gap-2">
                <span className="w-16 text-neutral-500 tabular-nums shrink-0">{date(c.publishAt)}</span>
                <button type="button" onClick={() => open(c)} className="truncate hover:text-[#2563EB] cursor-pointer text-left">{c.title}</button>
                <span className="text-neutral-400 capitalize shrink-0">· {c.channel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.loading ? (
        <Skeleton />
      ) : content.items.length === 0 ? (
        <div className="border border-[#E5E7EB] rounded-xl"><Empty title="No content planned" hint="Plan blog posts, social posts, emails and videos — or release a version to get its launch checklist." /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map(stage => {
            const list = content.items.filter(c => c.stage === stage);
            return (
              <div key={stage} onDragOver={e => e.preventDefault()} onDrop={() => { const it = content.items.find(c => c.id === dragId); if (it && it.stage !== stage) content.update(it.id, { stage }).catch(e => toast.error((e as Error).message)); setDragId(null); }} className="w-56 shrink-0 bg-neutral-50/70 rounded-xl p-2">
                <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                  <span className="text-[12px] font-medium text-neutral-600 capitalize">{stage}</span>
                  <span className="text-[11px] text-neutral-400">{list.length}</span>
                </div>
                <div className="space-y-1.5 min-h-[60px]">
                  {list.map(c => (
                    <button key={c.id} type="button" draggable onDragStart={() => setDragId(c.id)} onClick={() => open(c)} className={cx('w-full text-left bg-white border border-[#E5E7EB] rounded-lg p-2.5 hover:border-neutral-300 cursor-pointer', dragId === c.id && 'opacity-50')}>
                      <p className="text-[12.5px] leading-snug line-clamp-2">{c.title}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge>{c.channel}</Badge>
                        {c.releaseId && <Badge tone="violet">Launch</Badge>}
                        <span className="ml-auto text-[11px] text-neutral-400">{c.publishAt ? date(c.publishAt) : memberName(c.ownerId).split(' ')[0]}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Drawer
        open={Boolean(editing)}
        title={editing === 'new' ? 'New content' : 'Content'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <div>{editing && editing !== 'new' && <ConfirmButton onConfirm={() => content.remove((editing as Rec).id).then(() => setEditing(null)).catch(e => toast.error((e as Error).message))} />}</div>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
          </>
        }
      >
        <FormFields fields={fields} values={values} onChange={(n, v) => setValues(s => ({ ...s, [n]: v }))} />
        {editing && editing !== 'new' && (
          <div className="pt-3 border-t border-[#E5E7EB]">
            <AiAssist task="draft_content" id={(editing as Rec).id} label="Write a first draft with FlowAi" hint="Saved into the brief" onDone={() => { setEditing(null); void content.reload(true); }} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

/* ─────────────────────────────── Brand kit ─────────────────────────────── */

function Brand() {
  const toast = useToast();
  const brand = useRecords<Rec>('brand', {}, { limit: 100 });
  const [editing, setEditing] = useState<Rec | 'new' | null>(null);
  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', required: true, placeholder: 'Primary logo, Brand blue, Heading font…' },
    { name: 'kind', label: 'Kind', type: 'select', required: true, options: opts(['logo', 'color', 'font', 'image', 'template', 'guideline', 'link']), half: true },
    { name: 'value', label: 'Value', required: true, placeholder: 'Link, #2563EB, or font name', half: true, hint: 'For logos and images, paste a link or upload below.' },
    { name: 'notes', label: 'How to use it', type: 'textarea' },
  ];
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const open = (rec: Rec | 'new') => {
    setEditing(rec);
    setValues(toForm(fields, rec === 'new' ? null : rec, { kind: 'color' }));
  };
  const save = async () => {
    try {
      const data = fromForm(fields, values);
      if (editing === 'new') await brand.create(data);
      else if (editing) await brand.update(editing.id, data);
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const upload = (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 1_000_000) return toast.error('Choose an image under 1 MB');
    const r = new FileReader();
    r.onload = () => setValues(s => ({ ...s, value: String(r.result), kind: s.kind === 'color' || s.kind === 'font' ? 'image' : s.kind }));
    r.readAsDataURL(file);
  };
  const isImage = (v: string) => /^data:image\//.test(v) || /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(v);

  return (
    <div>
      <div className="flex justify-end mb-3"><Button variant="primary" onClick={() => open('new')}>Add to brand kit</Button></div>
      {brand.loading ? (
        <Skeleton />
      ) : brand.items.length === 0 ? (
        <div className="border border-[#E5E7EB] rounded-xl"><Empty title="Your brand kit is empty" hint="Keep logos, colours, fonts and templates in one place so everyone uses the right ones." /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {brand.items.map(b => (
            <button key={b.id} type="button" onClick={() => open(b)} className="text-left border border-[#E5E7EB] rounded-xl overflow-hidden hover:border-neutral-300 cursor-pointer">
              <div className="h-24 bg-neutral-50 flex items-center justify-center overflow-hidden">
                {b.kind === 'color' && /^#|^rgb/.test(b.value) ? (
                  <div className="w-full h-full" style={{ background: b.value }} />
                ) : isImage(b.value) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.value} alt={b.name} className="max-h-20 max-w-[85%] object-contain" />
                ) : b.kind === 'font' ? (
                  <span className="text-2xl" style={{ fontFamily: b.value }}>Aa</span>
                ) : (
                  <span className="text-[11px] text-neutral-400 capitalize">{b.kind}</span>
                )}
              </div>
              <div className="px-3 py-2">
                <p className="text-[12.5px] font-medium truncate">{b.name}</p>
                <p className="text-[11px] text-neutral-500 truncate">{/^data:/.test(b.value) ? 'Uploaded image' : b.value}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <Drawer
        open={Boolean(editing)}
        title={editing === 'new' ? 'Add to brand kit' : 'Brand asset'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <div>{editing && editing !== 'new' && <ConfirmButton onConfirm={() => brand.remove((editing as Rec).id).then(() => setEditing(null)).catch(e => toast.error((e as Error).message))} />}</div>
            <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></div>
          </>
        }
      >
        <FormFields fields={fields} values={values} onChange={(n, v) => setValues(s => ({ ...s, [n]: v }))} />
        <label className="block text-[12px] text-[#2563EB] cursor-pointer">
          Upload an image
          <input type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </Drawer>
    </div>
  );
}

export default function MarketingHub() {
  const { suite } = useSuite();
  const [tab, setTab] = useState('campaigns');
  if (suite && !suite.enabled) return <PageShell title="Marketing"><Empty title="Not available" /></PageShell>;
  return (
    <PageShell title="Marketing" subtitle={suite?.teamName} tabs={TABS} tab={tab} onTab={setTab}>
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'content' && <Content />}
      {tab === 'brand' && <Brand />}
    </PageShell>
  );
}

export const CHANNEL_OPTIONS = opts(CHANNELS, CHANNEL_LABEL);
