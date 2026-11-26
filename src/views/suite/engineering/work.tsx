'use client';

/**
 * Work items (epics, stories, bugs …): list hook, type/severity badges and the create/edit drawer.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLiveRefresh } from '@/lib/liveSync';
import { suiteApi } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, ConfirmButton, Drawer, Field, Input, Select, Textarea, type Tone } from '@/components/suite/ui';
import { opts } from '@/components/suite/records';

export interface CodeRef {
  taskId: string | null;
  state: string;
  url: string;
  number: number | null;
  repo: string;
  reviewState: string | null;
  checks: string | null;
}

export interface WorkItem {
  id: string;
  taskNumber: string | null;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  itemType: string;
  storyPoints: number | null;
  severity: string | null;
  bugDetails: { steps?: string; expected?: string; actual?: string; environment?: string; device?: string } | null;
  sprintId: string | null;
  releaseId: string | null;
  parentId: string | null;
  projectId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string } | null;
  code?: CodeRef[];
}

export const ITEM_TYPES = ['story', 'task', 'bug', 'epic', 'spike', 'tech_debt', 'chore'];
export const TYPE_TONE: Record<string, Tone> = {
  epic: 'violet', story: 'green', task: 'blue', bug: 'red', spike: 'amber', tech_debt: 'neutral', chore: 'neutral',
};
export const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog', todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done',
};
export const STATUS_TONE: Record<string, Tone> = {
  backlog: 'neutral', todo: 'neutral', in_progress: 'blue', in_review: 'amber', done: 'green',
};
export const SEV_TONE: Record<string, Tone> = { sev1: 'red', sev2: 'amber', sev3: 'neutral', sev4: 'neutral' };

export function TypeBadge({ type }: { type: string }) {
  return <Badge tone={TYPE_TONE[type] ?? 'neutral'}>{type === 'tech_debt' ? 'Tech debt' : type.replace(/^\w/, c => c.toUpperCase())}</Badge>;
}

export function useWork(filters: Record<string, string | undefined>, enabled = true) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1]))).toString();

  const reload = useCallback(
    async (quiet = false) => {
      if (!enabled) return;
      if (!quiet) setLoading(true);
      try {
        setItems(await suiteApi<WorkItem[]>(`/api/suite/work?${query}`));
      } catch {
        /* keep the last list */
      } finally {
        setLoading(false);
      }
    },
    [query, enabled]
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useLiveRefresh(['suite', 'tasks'], () => void reload(true));

  const patch = useCallback(async (id: string, data: Record<string, unknown>) => {
    let before: WorkItem | undefined;
    setItems(prev => prev.map(i => (i.id === id ? ((before = i), { ...i, ...data } as WorkItem) : i)));
    try {
      const saved = await suiteApi<WorkItem>(`/api/suite/work/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      setItems(prev => prev.map(i => (i.id === id ? { ...i, ...saved } : i)));
    } catch (e) {
      if (before) setItems(prev => prev.map(i => (i.id === id ? (before as WorkItem) : i)));
      throw e;
    }
  }, []);

  return { items, setItems, loading, reload, patch };
}

export function PrChips({ code }: { code?: CodeRef[] }) {
  if (!code?.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {code.slice(0, 3).map(c => (
        <a
          key={c.url}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[11px] text-neutral-500 hover:text-[#2563EB]"
          title={`${c.repo}#${c.number} — ${c.state}${c.checks ? `, checks ${c.checks}` : ''}${c.reviewState ? `, ${c.reviewState.replace('_', ' ')}` : ''}`}
        >
          <Badge tone={c.state === 'merged' ? 'violet' : c.state === 'open' ? (c.checks === 'failure' ? 'red' : 'green') : 'neutral'}>PR #{c.number}</Badge>
        </a>
      ))}
    </span>
  );
}

interface DrawerProps {
  open: boolean;
  item: WorkItem | null;
  defaults?: Partial<Record<keyof WorkItem, unknown>>;
  sprints?: { id: string; name: string; status: string }[];
  releases?: { id: string; version: string }[];
  epics?: WorkItem[];
  onClose: () => void;
  onSaved: (item: WorkItem) => void;
  onDeleted?: (id: string) => void;
  onOpenTask?: (id: string) => void;
}

export function WorkItemDrawer({ open, item, defaults, sprints = [], releases = [], epics = [], onClose, onSaved, onDeleted, onOpenTask }: DrawerProps) {
  const toast = useToast();
  const { suite } = useSuite();
  const people = useMemo(() => (suite?.members || []).map(m => ({ value: m.id, label: m.name })), [suite?.members]);
  const projects = useMemo(() => (suite?.projects || []).map(p => ({ value: p.id, label: p.name })), [suite?.projects]);
  const [v, setV] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const src = (item ?? defaults ?? {}) as Record<string, unknown>;
    const bug = (src.bugDetails as Record<string, string> | null) || {};
    setV({
      title: String(src.title ?? ''),
      description: String(src.description ?? ''),
      itemType: String(src.itemType ?? 'story'),
      projectId: String(src.projectId ?? projects[0]?.value ?? ''),
      status: String(src.status ?? 'backlog'),
      priority: String(src.priority ?? 'medium'),
      storyPoints: src.storyPoints === null || src.storyPoints === undefined ? '' : String(src.storyPoints),
      assigneeId: String(src.assigneeId ?? ''),
      sprintId: String(src.sprintId ?? ''),
      releaseId: String(src.releaseId ?? ''),
      parentId: String(src.parentId ?? ''),
      severity: String(src.severity ?? 'sev3'),
      steps: bug.steps ?? '',
      expected: bug.expected ?? '',
      actual: bug.actual ?? '',
      environment: bug.environment ?? '',
      device: bug.device ?? '',
    });
  }, [open, item, defaults, projects]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(s => ({ ...s, [k]: e.target.value }));
  const isBug = v.itemType === 'bug';

  const save = async () => {
    if (!v.title?.trim()) return toast.error('Give it a title');
    if (!v.projectId) return toast.error('Choose a project first (create one in Projects)');
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: v.title.trim(),
      description: v.description,
      itemType: v.itemType,
      projectId: v.projectId,
      status: v.status,
      priority: v.priority,
      storyPoints: v.storyPoints === '' ? null : Number(v.storyPoints),
      assigneeId: v.assigneeId || null,
      sprintId: v.sprintId || null,
      releaseId: v.releaseId || null,
      parentId: v.itemType === 'epic' ? null : v.parentId || null,
      ...(isBug
        ? { severity: v.severity, bugDetails: { steps: v.steps, expected: v.expected, actual: v.actual, environment: v.environment, device: v.device } }
        : {}),
    };
    try {
      const saved = item
        ? await suiteApi<WorkItem>(`/api/suite/work/${item.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await suiteApi<WorkItem>('/api/suite/work', { method: 'POST', body: JSON.stringify(payload) });
      onSaved(saved);
      toast.success(item ? 'Saved' : `${saved.taskNumber ?? 'Item'} created`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!item) return;
    try {
      await suiteApi(`/api/suite/work/${item.id}`, { method: 'DELETE' });
      onDeleted?.(item.id);
      toast.success('Deleted');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer
      open={open}
      wide
      title={item ? `${item.taskNumber ?? ''} ${item.title}`.trim() : 'New work item'}
      onClose={onClose}
      footer={
        <>
          <div className="flex items-center gap-1">
            {item && <ConfirmButton onConfirm={del} />}
            {item && onOpenTask && (
              <Button variant="ghost" size="sm" onClick={() => onOpenTask(item.id)}>
                Comments & activity
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : item ? 'Save' : 'Create'}</Button>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" className="col-span-2">
          <Input value={v.title ?? ''} onChange={set('title')} placeholder="What needs to be done?" autoFocus />
        </Field>
        <Field label="Type" className="col-span-1">
          <Select value={v.itemType ?? ''} onChange={set('itemType')} options={opts(ITEM_TYPES, { tech_debt: 'Tech debt' })} />
        </Field>
        <Field label="Project" className="col-span-1">
          <Select value={v.projectId ?? ''} onChange={set('projectId')} options={projects} placeholder={projects.length ? undefined : 'No projects yet'} />
        </Field>
        <Field label="Status" className="col-span-1">
          <Select value={v.status ?? ''} onChange={set('status')} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Priority" className="col-span-1">
          <Select value={v.priority ?? ''} onChange={set('priority')} options={opts(['low', 'medium', 'high', 'urgent'])} />
        </Field>
        <Field label="Assignee" className="col-span-1">
          <Select value={v.assigneeId ?? ''} onChange={set('assigneeId')} options={people} placeholder="Unassigned" />
        </Field>
        <Field label="Story points" className="col-span-1">
          <Select value={v.storyPoints ?? ''} onChange={set('storyPoints')} options={['1', '2', '3', '5', '8', '13', '21'].map(p => ({ value: p, label: p }))} placeholder="—" />
        </Field>
        <Field label="Sprint" className="col-span-1">
          <Select value={v.sprintId ?? ''} onChange={set('sprintId')} options={sprints.filter(s => s.status !== 'completed' || s.id === v.sprintId).map(s => ({ value: s.id, label: s.name }))} placeholder="Backlog" />
        </Field>
        <Field label="Release" className="col-span-1">
          <Select value={v.releaseId ?? ''} onChange={set('releaseId')} options={releases.map(r => ({ value: r.id, label: r.version }))} placeholder="None" />
        </Field>
        {v.itemType !== 'epic' && (
          <Field label="Epic" className="col-span-2">
            <Select value={v.parentId ?? ''} onChange={set('parentId')} options={epics.filter(e => e.id !== item?.id).map(e => ({ value: e.id, label: `${e.taskNumber ?? ''} ${e.title}`.trim() }))} placeholder="None" />
          </Field>
        )}
        {isBug && (
          <>
            <Field label="Severity" className="col-span-1">
              <Select value={v.severity ?? ''} onChange={set('severity')} options={[{ value: 'sev1', label: 'SEV1 — critical' }, { value: 'sev2', label: 'SEV2 — major' }, { value: 'sev3', label: 'SEV3 — minor' }, { value: 'sev4', label: 'SEV4 — trivial' }]} />
            </Field>
            <Field label="Environment" className="col-span-1">
              <Input value={v.environment ?? ''} onChange={set('environment')} placeholder="Production, staging…" />
            </Field>
            <Field label="Steps to reproduce" className="col-span-2">
              <Textarea value={v.steps ?? ''} onChange={set('steps')} placeholder={'1. Open …\n2. Click …'} />
            </Field>
            <Field label="Expected result" className="col-span-1">
              <Textarea value={v.expected ?? ''} onChange={set('expected')} className="min-h-[64px]" />
            </Field>
            <Field label="Actual result" className="col-span-1">
              <Textarea value={v.actual ?? ''} onChange={set('actual')} className="min-h-[64px]" />
            </Field>
            <Field label="Browser / device" className="col-span-2">
              <Input value={v.device ?? ''} onChange={set('device')} placeholder="Chrome 131, iPhone 15…" />
            </Field>
          </>
        )}
        <Field label="Description" className="col-span-2">
          <Textarea value={v.description ?? ''} onChange={set('description')} placeholder="Details, acceptance criteria…" />
        </Field>
      </div>
      {item?.code && item.code.length > 0 && (
        <div className="pt-3 border-t border-[#E5E7EB]">
          <p className="text-[12px] font-medium text-neutral-700 mb-2">Pull requests</p>
          <ul className="space-y-1.5">
            {item.code.map(c => (
              <li key={c.url} className="flex items-center gap-2 text-[12.5px]">
                <Badge tone={c.state === 'merged' ? 'violet' : c.state === 'open' ? 'green' : 'neutral'}>{c.state}</Badge>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline truncate">
                  {c.repo}#{c.number}
                </a>
                {c.checks && <span className="text-neutral-500">checks {c.checks}</span>}
                {c.reviewState && <span className="text-neutral-500">{c.reviewState.replace('_', ' ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!item && (
        <p className="text-[11.5px] text-neutral-400">
          Tip: put the item key (e.g. TF-123) in a branch or pull request name and FlowSync links it automatically.
        </p>
      )}
    </Drawer>
  );
}
