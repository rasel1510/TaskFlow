'use client';

import React, { useMemo } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useRecords, suiteApi, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, ProgressBar, cx, date } from '@/components/suite/ui';
import { RecordsTab, opts, type FieldDef, type RecordApi } from '@/components/suite/records';
import { STATUS_LABEL, TypeBadge, useWork } from './work';
import AiAssist from '@/components/suite/AiAssist';

export const STAGES = ['planned', 'development', 'code_freeze', 'qa', 'staging', 'released'] as const;
export const STAGE_LABEL: Record<string, string> = {
  planned: 'Planned', development: 'Development', code_freeze: 'Code freeze', qa: 'QA', staging: 'Staging', released: 'Released', rolled_back: 'Rolled back',
};
export const STAGE_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  planned: 'neutral', development: 'blue', code_freeze: 'amber', qa: 'amber', staging: 'amber', released: 'green', rolled_back: 'red',
};

const DEFAULT_CHECKLIST = [
  { id: 'done', label: 'All planned items done', done: false },
  { id: 'qa', label: 'QA test run passed', done: false },
  { id: 'security', label: 'Security checklist reviewed', done: false },
  { id: 'notes', label: 'Release notes written', done: false },
  { id: 'rollback', label: 'Rollback plan ready', done: false },
];
const SIGNOFF_ROLES = ['qa', 'security', 'product', 'engineering'] as const;

function ReleaseDetail({ rec, api }: { rec: Rec; api: RecordApi }) {
  const update = api.update;
  const toast = useToast();
  const { memberName } = useSuite();
  const work = useWork({ releaseId: rec.id });
  const done = work.items.filter(i => i.status === 'done').length;
  const checklist = (rec.checklist as { id: string; label: string; done: boolean }[] | null) || [];
  const signoffs = (rec.signoffs as { role: string; userId: string; at: string }[] | null) || [];

  const act = async (body: Record<string, unknown>, msg: string) => {
    try {
      const res = await suiteApi<{ launch?: number; requestsShipped?: number }>('/api/suite/actions', { method: 'POST', body: JSON.stringify(body) });
      const extra = [res?.launch ? `${res.launch} launch items for Marketing` : '', res?.requestsShipped ? `${res.requestsShipped} feature request(s) shipped` : ''].filter(Boolean).join(' · ');
      toast.success(extra ? `${msg} — ${extra}` : msg);
      void api.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = (id: string) => {
    const next = checklist.map(c => (c.id === id ? { ...c, done: !c.done } : c));
    update(rec.id, { checklist: next }).catch(e => toast.error((e as Error).message));
  };

  return (
    <div className="space-y-5">
      {/* Stage */}
      <div>
        <p className="text-[12px] font-medium text-neutral-700 mb-2">Stage</p>
        <div className="flex flex-wrap gap-1">
          {STAGES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => s !== rec.stage && act({ action: 'release.stage', releaseId: rec.id, stage: s }, `Moved to ${STAGE_LABEL[s]}`)}
              className={cx(
                'h-7 px-2.5 rounded-lg text-[12px] border transition-colors duration-150 ease-out cursor-pointer',
                rec.stage === s ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-[#E5E7EB] text-neutral-600 hover:bg-neutral-50'
              )}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
          {rec.stage === 'released' && (
            <Button variant="danger" size="sm" onClick={() => act({ action: 'release.stage', releaseId: rec.id, stage: 'rolled_back' }, 'Marked as rolled back')}>
              Roll back
            </Button>
          )}
        </div>
        {rec.releasedAt && <p className="text-[11.5px] text-neutral-500 mt-1.5">Released {date(rec.releasedAt, true)}</p>}
      </div>

      {/* Work */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium text-neutral-700">Work in this release</p>
          <span className="text-[11.5px] text-neutral-500 tabular-nums">{done} / {work.items.length} done</span>
        </div>
        <ProgressBar value={work.items.length ? (done / work.items.length) * 100 : 0} tone="green" />
        {work.items.length === 0 ? (
          <p className="text-[12.5px] text-neutral-500 mt-2">Link work items to this release from their drawer (Release field).</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl max-h-56 overflow-y-auto">
            {work.items.map(i => (
              <li key={i.id} className="px-3 py-2 flex items-center gap-2 text-[12.5px]">
                <TypeBadge type={i.itemType} />
                <span className="truncate flex-1">{i.title}</span>
                <span className="text-neutral-500 shrink-0">{STATUS_LABEL[i.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Checklist */}
      <div>
        <p className="text-[12px] font-medium text-neutral-700 mb-2">Release checklist</p>
        <ul className="space-y-1.5">
          {checklist.map(c => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={c.done} onChange={() => toggle(c.id)} className="w-4 h-4 accent-[#2563EB]" />
                <span className={c.done ? 'text-neutral-400' : 'text-[#111111]'}>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Sign-off */}
      <div>
        <p className="text-[12px] font-medium text-neutral-700 mb-2">Sign-off</p>
        <div className="grid grid-cols-2 gap-2">
          {SIGNOFF_ROLES.map(role => {
            const s = signoffs.find(x => x.role === role);
            return (
              <div key={role} className="border border-[#E5E7EB] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium capitalize">{role === 'qa' ? 'QA' : role}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{s ? `${memberName(s.userId)} · ${date(s.at)}` : 'Waiting'}</p>
                </div>
                {!s && (
                  <Button size="sm" onClick={() => act({ action: 'release.signoff', releaseId: rec.id, role }, 'Signed off')}>
                    Approve
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => act({ action: 'release.notes', releaseId: rec.id }, 'Release notes written from the completed items')}>Generate release notes</Button>
        <span className="text-[11.5px] text-neutral-400">Reopen the release to see them in Notes.</span>
      </div>
      <AiAssist task="release_notes" id={rec.id} label="Rewrite notes for customers with FlowAi" onDone={() => void api.reload(true)} />
    </div>
  );
}

export default function Releases() {
  const products = useRecords<Rec>('products', {}, { limit: 100 });
  const productOpts = useMemo(() => products.items.map(p => ({ value: p.id, label: String(p.name) })), [products.items]);
  const productName = (id: string | null) => products.items.find(p => p.id === id)?.name ?? '—';

  const fields: FieldDef[] = [
    { name: 'version', label: 'Version', required: true, placeholder: 'v2.4.0', half: true },
    { name: 'kind', label: 'Type', type: 'select', required: true, options: opts(['major', 'minor', 'patch', 'hotfix']), half: true },
    { name: 'title', label: 'Name (optional)', placeholder: 'Spring update' },
    { name: 'productId', label: 'Product', type: 'select', options: productOpts, half: true },
    { name: 'targetDate', label: 'Target date', type: 'date', half: true },
    { name: 'supportEndsAt', label: 'Supported until', type: 'date', half: true },
    { name: 'notes', label: 'Release notes', type: 'textarea', placeholder: 'Generated from completed items, or write your own' },
  ];

  return (
    <RecordsTab
      entity="releases"
      noun="Release"
      wide
      fields={fields}
      defaults={{ kind: 'minor', checklist: DEFAULT_CHECKLIST }}
      filterBar={[
        { key: 'stage', label: 'Stages', options: [...STAGES, 'rolled_back'].map(s => ({ value: s, label: STAGE_LABEL[s] })) },
        ...(productOpts.length ? [{ key: 'productId', label: 'Products', options: productOpts }] : []),
      ]}
      empty={{ title: 'No releases yet', hint: 'Create a version, link work items to it, and move it through the stages to Released.' }}
      columns={[
        { head: 'Version', render: r => <span className="font-medium">{r.version}{r.title ? <span className="text-neutral-500 font-normal"> · {r.title}</span> : null}</span> },
        { head: 'Product', render: r => productName(r.productId), muted: true },
        { head: 'Type', render: r => <span className="capitalize">{r.kind}</span>, muted: true },
        { head: 'Stage', render: r => <Badge tone={STAGE_TONE[r.stage]}>{STAGE_LABEL[r.stage]}</Badge> },
        { head: 'Target', render: r => (r.releasedAt ? `Released ${date(r.releasedAt)}` : date(r.targetDate)), muted: true },
      ]}
      detail={(rec, _close, api) => <ReleaseDetail rec={rec} api={api} />}
    />
  );
}
