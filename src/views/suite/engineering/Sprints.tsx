'use client';

import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useRecords, suiteApi, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import {
  Badge, Button, Cell, Drawer, Empty, Field, Input, ProgressBar, Row, SectionHeader, Select, Skeleton, Table, Textarea, cx, date, toDateInput,
} from '@/components/suite/ui';
import { PrChips, SEV_TONE, STATUS_LABEL, TypeBadge, WorkItemDrawer, useWork, type WorkItem } from './work';

interface Sprint extends Rec {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
}

const COLUMNS: WorkItem['status'][] = ['todo', 'in_progress', 'in_review', 'done'];

function Burndown({ sprint, items }: { sprint: Sprint; items: WorkItem[] }) {
  const total = items.reduce((s, i) => s + (i.storyPoints ?? 1), 0);
  const start = new Date(sprint.startDate).getTime();
  const end = new Date(sprint.endDate).getTime();
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const today = Math.min(days, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const remaining = Array.from({ length: today + 1 }, (_, d) => {
    const cutoff = start + (d + 1) * 86400000;
    const done = items.filter(i => i.completedAt && new Date(i.completedAt).getTime() < cutoff).reduce((s, i) => s + (i.storyPoints ?? 1), 0);
    return total - done;
  });
  const W = 220;
  const H = 56;
  const x = (d: number) => (d / days) * W;
  const y = (v: number) => (total ? H - (v / total) * H : H);
  return (
    <svg width={W} height={H + 4} viewBox={`0 -2 ${W} ${H + 4}`} role="img" aria-label="Burndown: remaining points over the sprint">
      <line x1={0} y1={y(total)} x2={W} y2={H} stroke="#E5E7EB" strokeDasharray="3 3" />
      <polyline fill="none" stroke="#2563EB" strokeWidth="1.75" points={remaining.map((v, d) => `${x(d)},${y(v)}`).join(' ')} />
    </svg>
  );
}

export default function Sprints({ onOpenTask }: { onOpenTask?: (id: string) => void }) {
  const toast = useToast();
  const { suite } = useSuite();
  const sprints = useRecords<Sprint>('sprints', {}, { limit: 100 });
  const releases = useRecords<Rec>('releases', {}, { limit: 100 });
  const ordered = useMemo(() => {
    const rank = { active: 0, planned: 1, completed: 2 } as const;
    return [...sprints.items].sort((a, b) => rank[a.status] - rank[b.status] || +new Date(a.startDate) - +new Date(b.startDate));
  }, [sprints.items]);

  const [chosenId, setChosenId] = useState<string>('');
  const sprint = ordered.find(s => s.id === chosenId) ?? ordered[0];
  const board = useWork({ sprintId: sprint?.id }, Boolean(sprint));
  const backlog = useWork({ backlog: '1' });
  const epics = useWork({ type: 'epic', open: '1' });

  const [drawer, setDrawer] = useState<{ item: WorkItem | null; defaults?: Record<string, unknown> } | null>(null);
  const [sprintForm, setSprintForm] = useState<Sprint | 'new' | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [carryTo, setCarryTo] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const points = (list: WorkItem[]) => list.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const doneItems = board.items.filter(i => i.status === 'done');
  const pct = board.items.length ? (points(doneItems) || doneItems.length) / (points(board.items) || board.items.length) * 100 : 0;
  const daysLeft = sprint ? Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86400000) : 0;

  const move = async (item: WorkItem, data: Record<string, unknown>, list: ReturnType<typeof useWork>) => {
    try {
      await list.patch(item.id, data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const planInto = async (item: WorkItem, sprintId: string) => {
    try {
      await suiteApi(`/api/suite/work/${item.id}`, { method: 'PATCH', body: JSON.stringify({ sprintId: sprintId || null, ...(sprintId ? { status: sprint?.status === 'active' ? 'todo' : 'backlog' } : {}) }) });
      backlog.setItems(prev => prev.filter(i => i.id !== item.id));
      void board.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const action = async (name: 'sprint.start' | 'sprint.complete') => {
    if (!sprint) return;
    try {
      const res = await suiteApi<{ carried?: number }>('/api/suite/actions', {
        method: 'POST',
        body: JSON.stringify({ action: name, sprintId: sprint.id, ...(name === 'sprint.complete' ? { carryToSprintId: carryTo || null } : {}) }),
      });
      toast.success(name === 'sprint.start' ? 'Sprint started' : `Sprint completed${res.carried ? ` — ${res.carried} unfinished item${res.carried === 1 ? '' : 's'} moved on` : ''}`);
      setCompleteOpen(false);
      void sprints.reload(true);
      void board.reload(true);
      void backlog.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onSaved = (saved: WorkItem) => {
    void board.reload(true);
    void backlog.reload(true);
    if (saved.itemType === 'epic') void epics.reload(true);
  };

  const sprintOptions = ordered.map(s => ({ id: s.id, name: s.name, status: s.status }));
  const releaseOptions = releases.items.map(r => ({ id: r.id, version: String(r.version) }));

  return (
    <div className="space-y-8">
      {/* Sprint */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          {ordered.length > 0 && (
            <Select
              aria-label="Sprint"
              value={sprint?.id ?? ''}
              onChange={e => setChosenId(e.target.value)}
              options={ordered.map(s => ({ value: s.id, label: `${s.name}${s.status === 'active' ? ' · active' : s.status === 'completed' ? ' · done' : ''}` }))}
              className="sm:w-64"
            />
          )}
          <div className="flex gap-2 sm:ml-auto">
            {sprint && sprint.status !== 'completed' && (
              <Button variant="ghost" onClick={() => setSprintForm(sprint)}>Edit sprint</Button>
            )}
            {sprint?.status === 'planned' && <Button onClick={() => action('sprint.start')}>Start sprint</Button>}
            {sprint?.status === 'active' && <Button onClick={() => setCompleteOpen(true)}>Complete sprint</Button>}
            <Button variant="primary" onClick={() => setSprintForm('new')}>New sprint</Button>
          </div>
        </div>

        {sprints.loading ? (
          <Skeleton rows={3} />
        ) : !sprint ? (
          <div className="border border-[#E5E7EB] rounded-xl">
            <Empty title="No sprints yet" hint="Plan your first sprint: pick dates and a goal, then move items in from the backlog." action={<Button variant="primary" onClick={() => setSprintForm('new')}>New sprint</Button>} />
          </div>
        ) : (
          <>
            <div className="border border-[#E5E7EB] rounded-xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-[#111111] truncate">{sprint.name}</h2>
                  <Badge tone={sprint.status === 'active' ? 'blue' : sprint.status === 'completed' ? 'green' : 'neutral'}>{sprint.status}</Badge>
                </div>
                <p className="text-[12.5px] text-neutral-500 mt-0.5">
                  {date(sprint.startDate)} – {date(sprint.endDate)}
                  {sprint.status === 'active' && ` · ${daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'ends today'}`}
                </p>
                {sprint.goal && <p className="text-[13px] text-[#111111] mt-2">{sprint.goal}</p>}
                <div className="mt-3 max-w-md">
                  <div className="flex justify-between text-[11.5px] text-neutral-500 mb-1">
                    <span>{doneItems.length} of {board.items.length} items done</span>
                    <span className="tabular-nums">{points(doneItems)} / {points(board.items)} pts</span>
                  </div>
                  <ProgressBar value={pct} tone="green" />
                </div>
              </div>
              {sprint.status !== 'planned' && board.items.length > 0 && (
                <div className="shrink-0">
                  <p className="text-[11px] text-neutral-400 mb-1">Burndown</p>
                  <Burndown sprint={sprint} items={board.items} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {COLUMNS.map(col => {
                const list = board.items.filter(i => i.status === col);
                return (
                  <div
                    key={col}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      const it = board.items.find(i => i.id === dragId);
                      if (it && it.status !== col) void move(it, { status: col }, board);
                      setDragId(null);
                    }}
                    className="bg-neutral-50/70 rounded-xl p-2 min-h-[140px]"
                  >
                    <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                      <span className="text-[12px] font-medium text-neutral-600">{STATUS_LABEL[col]}</span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">{list.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {list.map(it => (
                        <button
                          key={it.id}
                          type="button"
                          draggable
                          onDragStart={() => setDragId(it.id)}
                          onClick={() => setDrawer({ item: it })}
                          className={cx('w-full text-left bg-white border border-[#E5E7EB] rounded-lg p-2.5 hover:border-neutral-300 transition-colors duration-150 ease-out cursor-pointer', dragId === it.id && 'opacity-50')}
                        >
                          <p className="text-[12.5px] text-[#111111] leading-snug line-clamp-2">{it.title}</p>
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <TypeBadge type={it.itemType} />
                            {it.severity && <Badge tone={SEV_TONE[it.severity]}>{it.severity.toUpperCase()}</Badge>}
                            <span className="text-[11px] text-neutral-400">{it.taskNumber}</span>
                            <PrChips code={it.code} />
                            <span className="ml-auto flex items-center gap-1.5">
                              {it.storyPoints !== null && <span className="text-[11px] text-neutral-500 tabular-nums">{it.storyPoints}</span>}
                              {it.assignee && <span className="text-[11px] text-neutral-500 truncate max-w-[80px]">{it.assignee.name.split(' ')[0]}</span>}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Backlog */}
      <section>
        <SectionHeader
          title="Backlog"
          hint={`${backlog.items.length} item${backlog.items.length === 1 ? '' : 's'} · ${points(backlog.items)} points`}
          actions={<Button variant="primary" onClick={() => setDrawer({ item: null, defaults: { status: 'backlog' } })}>New item</Button>}
        />
        {backlog.loading ? (
          <Skeleton />
        ) : (
          <Table head={['Item', 'Type', 'Priority', 'Points', 'Assignee', 'Plan into']} empty={<Empty title="The backlog is empty" hint="Add stories, bugs and tasks, then plan them into a sprint." />}>
            {backlog.items.map(it => (
              <Row key={it.id} onClick={() => setDrawer({ item: it })}>
                <Cell>
                  <span className="text-neutral-400 mr-1.5 text-[12px]">{it.taskNumber}</span>
                  {it.title}
                </Cell>
                <Cell><TypeBadge type={it.itemType} /></Cell>
                <Cell muted>{it.priority}</Cell>
                <Cell muted className="tabular-nums">{it.storyPoints ?? '—'}</Cell>
                <Cell muted>{it.assignee?.name ?? '—'}</Cell>
                <Cell>
                  <span onClick={e => e.stopPropagation()}>
                    <Select
                      aria-label="Plan into sprint"
                      value=""
                      onChange={e => planInto(it, e.target.value)}
                      options={ordered.filter(s => s.status !== 'completed').map(s => ({ value: s.id, label: s.name }))}
                      placeholder="Choose sprint"
                      className="w-40 h-7 text-[12px]"
                    />
                  </span>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </section>

      <WorkItemDrawer
        open={Boolean(drawer)}
        item={drawer?.item ?? null}
        defaults={drawer?.defaults as Partial<Record<keyof WorkItem, unknown>>}
        sprints={sprintOptions}
        releases={releaseOptions}
        epics={epics.items}
        onClose={() => setDrawer(null)}
        onSaved={onSaved}
        onDeleted={() => onSaved({ itemType: '' } as WorkItem)}
        onOpenTask={onOpenTask}
      />

      <SprintForm
        sprint={sprintForm}
        onClose={() => setSprintForm(null)}
        onSave={async data => {
          if (sprintForm === 'new') {
            const created = await sprints.create(data);
            setChosenId(created.id);
          } else if (sprintForm) await sprints.update(sprintForm.id, data);
        }}
        suggestedName={`Sprint ${sprints.items.length + 1}`}
      />

      <Drawer
        open={completeOpen}
        title={`Complete ${sprint?.name ?? 'sprint'}`}
        onClose={() => setCompleteOpen(false)}
        footer={
          <>
            <span />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCompleteOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => action('sprint.complete')}>Complete sprint</Button>
            </div>
          </>
        }
      >
        <p className="text-[13px] text-[#111111]">
          {board.items.filter(i => i.status !== 'done').length} unfinished item(s). Where should they go?
        </p>
        <Field label="Move unfinished items to">
          <Select value={carryTo} onChange={e => setCarryTo(e.target.value)} options={ordered.filter(s => s.status === 'planned').map(s => ({ value: s.id, label: s.name }))} placeholder="Backlog" />
        </Field>
      </Drawer>
      {suite && !suite.projects?.length && (
        <p className="text-[12px] text-neutral-500">Work items belong to a project — create a project first in Projects.</p>
      )}
    </div>
  );
}

function SprintForm({ sprint, onClose, onSave, suggestedName }: { sprint: Sprint | 'new' | null; onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<void>; suggestedName: string }) {
  const toast = useToast();
  const isNew = sprint === 'new';
  const today = new Date();
  const [v, setV] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const key = sprint === 'new' ? 'new' : sprint?.id;
  React.useEffect(() => {
    if (!sprint) return;
    if (sprint === 'new') {
      setV({ name: suggestedName, goal: '', startDate: toDateInput(today), endDate: toDateInput(new Date(today.getTime() + 13 * 86400000)) });
    } else {
      setV({ name: sprint.name, goal: sprint.goal, startDate: toDateInput(sprint.startDate), endDate: toDateInput(sprint.endDate) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = async () => {
    if (!v.name.trim()) return toast.error('Name the sprint');
    if (!v.startDate || !v.endDate || v.endDate < v.startDate) return toast.error('Choose a start date before the end date');
    setSaving(true);
    try {
      await onSave({ name: v.name.trim(), goal: v.goal, startDate: new Date(`${v.startDate}T00:00:00`).toISOString(), endDate: new Date(`${v.endDate}T23:59:00`).toISOString() });
      toast.success(isNew ? 'Sprint created' : 'Sprint saved');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer
      open={Boolean(sprint)}
      title={isNew ? 'New sprint' : 'Edit sprint'}
      onClose={onClose}
      footer={
        <>
          <span />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create' : 'Save'}</Button>
          </div>
        </>
      }
    >
      <Field label="Name"><Input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start"><Input type="date" value={v.startDate} onChange={e => setV({ ...v, startDate: e.target.value })} /></Field>
        <Field label="End"><Input type="date" value={v.endDate} onChange={e => setV({ ...v, endDate: e.target.value })} /></Field>
      </div>
      <Field label="Sprint goal" hint="One sentence the whole team can aim for."><Textarea value={v.goal} onChange={e => setV({ ...v, goal: e.target.value })} className="min-h-[64px]" /></Field>
    </Drawer>
  );
}
