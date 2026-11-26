'use client';

/**
 * src/components/suite/records.tsx — a complete, reusable "records" screen for the suite:
 * filter bar + search, a quiet table, and a side drawer to create / edit / delete one record.
 * Field definitions handle conversions (money ↔ cents, dates, tags, people, numbers).
 */
import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import {
  Button,
  Cell,
  ConfirmButton,
  Drawer,
  Empty,
  Field,
  Input,
  Row,
  SearchInput,
  Select,
  Skeleton,
  Table,
  Textarea,
  toDateInput,
} from '@/components/suite/ui';

export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'money' | 'person' | 'tags' | 'url' | 'email' | 'checkbox' | 'color';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** hide the field unless the condition holds for the current values */
  when?: (values: Record<string, unknown>) => boolean;
  half?: boolean;
}

/** Record → form values */
export function toForm(fields: FieldDef[], rec: Record<string, unknown> | null, defaults: Record<string, unknown> = {}): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = rec ? rec[f.name] : defaults[f.name];
    if (f.type === 'checkbox') out[f.name] = Boolean(v ?? defaults[f.name]);
    else if (f.type === 'money') out[f.name] = v === null || v === undefined ? '' : String(Number(v) / 100);
    else if (f.type === 'date') out[f.name] = toDateInput(v as string);
    else if (f.type === 'tags') out[f.name] = Array.isArray(v) ? (v as string[]).join(', ') : '';
    else out[f.name] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

/** Form values → API payload */
export function fromForm(fields: FieldDef[], values: Record<string, string | boolean>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.when && !f.when(values)) continue;
    switch (f.type) {
      case 'checkbox':
        out[f.name] = Boolean(v);
        break;
      case 'money':
        out[f.name] = v === '' ? null : Math.round(Number(v) * 100);
        break;
      case 'number':
        out[f.name] = v === '' ? null : Number(v);
        break;
      case 'date':
        out[f.name] = v ? new Date(`${v}T12:00:00`).toISOString() : null;
        break;
      case 'tags':
        out[f.name] = String(v || '').split(',').map(s => s.trim()).filter(Boolean);
        break;
      case 'person':
      case 'select':
        out[f.name] = v === '' ? (f.required ? '' : null) : v;
        break;
      default:
        out[f.name] = typeof v === 'string' ? v : '';
    }
  }
  return out;
}

export function FormFields({ fields, values, onChange }: { fields: FieldDef[]; values: Record<string, string | boolean>; onChange: (name: string, v: string | boolean) => void }) {
  const { suite } = useSuite();
  const people = useMemo(() => (suite?.members || []).map(m => ({ value: m.id, label: m.name })), [suite?.members]);
  const visible = fields.filter(f => !f.when || f.when(values));
  return (
    <div className="grid grid-cols-2 gap-3">
      {visible.map(f => {
        const v = values[f.name];
        const common = { id: `f-${f.name}`, name: f.name, required: f.required, placeholder: f.placeholder };
        let control: React.ReactNode;
        switch (f.type) {
          case 'textarea':
            control = <Textarea {...common} value={String(v ?? '')} onChange={e => onChange(f.name, e.target.value)} />;
            break;
          case 'select':
            control = <Select {...common} value={String(v ?? '')} onChange={e => onChange(f.name, e.target.value)} options={f.options || []} placeholder={f.required ? undefined : '—'} />;
            break;
          case 'person':
            control = <Select {...common} value={String(v ?? '')} onChange={e => onChange(f.name, e.target.value)} options={people} placeholder="Nobody" />;
            break;
          case 'checkbox':
            control = (
              <span className="flex items-center gap-2 h-8">
                <input type="checkbox" id={common.id} checked={Boolean(v)} onChange={e => onChange(f.name, e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
                <span className="text-[12.5px] text-neutral-600">{f.placeholder || 'Yes'}</span>
              </span>
            );
            break;
          case 'color':
            control = <Input {...common} type="color" value={String(v || '#2563EB')} onChange={e => onChange(f.name, e.target.value)} className="p-1" />;
            break;
          default:
            control = (
              <Input
                {...common}
                type={f.type === 'date' ? 'date' : f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
                step={f.type === 'money' ? '0.01' : undefined}
                min={f.type === 'number' || f.type === 'money' ? 0 : undefined}
                value={String(v ?? '')}
                onChange={e => onChange(f.name, e.target.value)}
              />
            );
        }
        return (
          <Field key={f.name} label={f.label + (f.required ? '' : '')} hint={f.hint} className={f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
            {control}
          </Field>
        );
      })}
    </div>
  );
}

export interface ColumnDef<T> {
  head: string;
  render: (rec: T) => React.ReactNode;
  className?: string;
  muted?: boolean;
}

export interface RecordApi {
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  reload: (quiet?: boolean) => Promise<void>;
}

export interface RecordsTabProps<T extends Rec> {
  entity: string;
  noun: string;
  fields: FieldDef[];
  columns: ColumnDef<T>[];
  defaults?: Record<string, unknown>;
  filters?: Record<string, string | undefined>;
  filterBar?: { key: string; label: string; options: { value: string; label: string }[] }[];
  empty: { title: string; hint?: string };
  search?: boolean;
  /** extra content in the drawer for an existing record (actions, related items) */
  detail?: (rec: T, close: () => void, api: RecordApi) => React.ReactNode;
  /** content shown above the table */
  header?: (items: T[]) => React.ReactNode;
  wide?: boolean;
  readOnly?: boolean;
}

export function RecordsTab<T extends Rec>(props: RecordsTabProps<T>) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const filters = { ...props.filters, ...Object.fromEntries(Object.entries(chosen).filter(([, v]) => v)), ...(q ? { q } : {}) };
  const { items, loading, error, hasMore, loadMore, create, update, remove, reload } = useRecords<T>(props.entity, filters);

  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setValues(toForm(props.fields, null, props.defaults));
    setCreating(true);
  };
  const openEdit = (rec: T) => {
    setCreating(false);
    setEditing(rec);
    setValues(toForm(props.fields, rec));
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = fromForm(props.fields, values);
      if (editing) {
        await update(editing.id, payload);
        toast.success(`${props.noun} saved`);
      } else {
        await create({ ...props.defaults, ...payload });
        toast.success(`${props.noun} added`);
      }
      close();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!editing) return;
    try {
      await remove(editing.id);
      toast.success(`${props.noun} deleted`);
      close();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const open = creating || Boolean(editing);
  // Keep the drawer's record fresh after live updates
  const current = editing ? (items.find(i => i.id === editing.id) as T | undefined) ?? editing : null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        {props.search !== false && <SearchInput value={q} onChange={setQ} placeholder={`Search ${props.noun.toLowerCase()}s`} />}
        {props.filterBar?.map(f => (
          <Select
            key={f.key}
            aria-label={f.label}
            value={chosen[f.key] || ''}
            onChange={e => setChosen(c => ({ ...c, [f.key]: e.target.value }))}
            options={f.options}
            placeholder={`All ${f.label.toLowerCase()}`}
            className="sm:w-44"
          />
        ))}
        <div className="sm:ml-auto">
          {!props.readOnly && (
            <Button variant="primary" onClick={openNew}>
              New {props.noun.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      {props.header?.(items)}

      {loading ? (
        <Skeleton />
      ) : error ? (
        <Empty title="Couldn’t load" hint={error} />
      ) : (
        <Table head={props.columns.map(c => c.head)} empty={<Empty title={props.empty.title} hint={props.empty.hint} />}>
          {items.map(rec => (
            <Row key={rec.id} onClick={() => openEdit(rec)}>
              {props.columns.map(c => (
                <Cell key={c.head} className={c.className} muted={c.muted}>
                  {c.render(rec)}
                </Cell>
              ))}
            </Row>
          ))}
        </Table>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" onClick={() => loadMore().catch(e => toast.error((e as Error).message))}>
            Load more
          </Button>
        </div>
      )}

      <Drawer
        open={open}
        wide={props.wide}
        title={editing ? `${props.noun}` : `New ${props.noun.toLowerCase()}`}
        onClose={close}
        footer={
          <>
            <div>{editing && <ConfirmButton onConfirm={del} />}</div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
              </Button>
            </div>
          </>
        }
      >
        <FormFields fields={props.fields} values={values} onChange={(n, v) => setValues(s => ({ ...s, [n]: v }))} />
        {current && props.detail && <div className="pt-3 mt-1 border-t border-[#E5E7EB]">{props.detail(current, close, { update, reload })}</div>}
      </Drawer>
    </div>
  );
}

export const opts = (values: string[], labels?: Record<string, string>) =>
  values.map(v => ({ value: v, label: labels?.[v] ?? v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) }));
