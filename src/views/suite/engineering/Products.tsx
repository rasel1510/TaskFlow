'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, ConfirmButton, Person } from '@/components/suite/ui';
import { FormFields, RecordsTab, fromForm, opts, toForm, type FieldDef } from '@/components/suite/records';

const PRODUCT_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'description', label: 'What it is', type: 'textarea' },
  { name: 'status', label: 'Status', type: 'select', options: opts(['active', 'maintained', 'retired']), required: true, half: true },
  { name: 'ownerId', label: 'Owner', type: 'person', half: true },
];

const COMPONENT_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', required: true, placeholder: 'Web app, API, iOS app…', half: true },
  { name: 'kind', label: 'Kind', type: 'select', required: true, options: opts(['web', 'mobile', 'api', 'admin', 'worker', 'other'], { api: 'API' }), half: true },
  { name: 'techStack', label: 'Tech stack', type: 'tags', placeholder: 'Next.js, Postgres, Prisma' },
  { name: 'repoFullName', label: 'GitHub repo', placeholder: 'owner/repo', half: true },
  { name: 'vercelProjectId', label: 'Vercel project', placeholder: 'Project name or id', half: true },
  { name: 'liveUrl', label: 'Production URL', type: 'url', placeholder: 'https://', half: true },
  { name: 'stagingUrl', label: 'Staging URL', type: 'url', placeholder: 'https://', half: true },
  { name: 'docsUrl', label: 'Docs URL', type: 'url', placeholder: 'https://', half: true },
  { name: 'ownerId', label: 'Owner', type: 'person', half: true },
];

const STATUS_TONE = { active: 'green', maintained: 'blue', retired: 'neutral' } as const;

/** Public changelog / status page of a product (Admins and Project Managers publish them). */
function PublicPage({ productId, kind, title, hint }: { productId: string; kind: 'changelog' | 'status'; title: string; hint: string }) {
  const toast = useToast();
  const { suite } = useSuite();
  const [state, setState] = useState<{ enabled: boolean; url?: string } | null>(null);
  useEffect(() => {
    setState(null);
    suiteApi<{ enabled: boolean; url?: string }>(`/api/suite/share?kind=${kind}&targetId=${productId}`).then(setState).catch(() => setState({ enabled: false }));
  }, [productId, kind]);
  const canPublish = Boolean(suite?.me?.isManager);
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium">{title}</p>
        <p className="text-[11.5px] text-neutral-500">{state?.enabled && state.url ? <a href={state.url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] break-all">{state.url}</a> : hint}</p>
      </div>
      {canPublish && state && (
        state.enabled ? (
          <Button size="sm" variant="ghost" onClick={() => suiteApi(`/api/suite/share?kind=${kind}&targetId=${productId}`, { method: 'DELETE' }).then(() => setState({ enabled: false })).catch(e => toast.error((e as Error).message))}>Unpublish</Button>
        ) : (
          <Button size="sm" onClick={() => suiteApi<{ enabled: boolean; url: string }>('/api/suite/share', { method: 'POST', body: JSON.stringify({ kind, targetId: productId }) }).then(setState).catch(e => toast.error((e as Error).message))}>Publish</Button>
        )
      )}
    </div>
  );
}

function Components({ productId }: { productId: string }) {
  const toast = useToast();
  const { items, create, update, remove } = useRecords<Rec>('components', { productId });
  const [editing, setEditing] = useState<Rec | 'new' | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const open = (rec: Rec | 'new') => {
    setEditing(rec);
    setValues(toForm(COMPONENT_FIELDS, rec === 'new' ? null : rec, { kind: 'web' }));
  };
  const save = async () => {
    try {
      const data = fromForm(COMPONENT_FIELDS, values);
      if (editing === 'new') await create({ ...data, productId });
      else if (editing) await update(editing.id, data);
      setEditing(null);
      toast.success('Component saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-medium text-neutral-700">Components</p>
        {!editing && <Button size="sm" onClick={() => open('new')}>Add component</Button>}
      </div>
      {editing ? (
        <div className="border border-[#E5E7EB] rounded-xl p-3 space-y-3">
          <FormFields fields={COMPONENT_FIELDS} values={values} onChange={(n, v) => setValues(s => ({ ...s, [n]: v }))} />
          <div className="flex justify-between">
            <div>{editing !== 'new' && <ConfirmButton onConfirm={() => remove((editing as Rec).id).then(() => setEditing(null)).catch(e => toast.error((e as Error).message))} />}</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={save}>Save component</Button>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-neutral-500">No components yet — add the web app, API, mobile app… that make up this product.</p>
      ) : (
        <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
          {items.map(c => (
            <li key={c.id}>
              <button type="button" onClick={() => open(c)} className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#111111]">{c.name}</span>
                  <Badge>{c.kind === 'api' ? 'API' : c.kind}</Badge>
                  {c.repoFullName && <span className="text-[11.5px] text-neutral-500 truncate">{c.repoFullName}</span>}
                </div>
                {(c.techStack?.length > 0 || c.liveUrl) && (
                  <p className="text-[11.5px] text-neutral-500 mt-0.5 truncate">
                    {(c.techStack || []).join(' · ')}
                    {c.liveUrl && <span className="ml-2">{c.liveUrl}</span>}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Products() {
  const { memberName } = useSuite();
  return (
    <RecordsTab
      entity="products"
      noun="Product"
      wide
      fields={PRODUCT_FIELDS}
      defaults={{ status: 'active' }}
      filterBar={[{ key: 'status', label: 'Statuses', options: opts(['active', 'maintained', 'retired']) }]}
      empty={{ title: 'No products yet', hint: 'Add the products your company builds. Each product is made of components such as a web app, an API or a mobile app.' }}
      columns={[
        { head: 'Product', render: r => <span className="font-medium">{r.name}</span> },
        { head: 'Status', render: r => <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? 'neutral'}>{r.status}</Badge> },
        { head: 'Owner', render: r => <Person name={memberName(r.ownerId)} /> },
        { head: 'About', render: r => <span className="line-clamp-1">{r.description || '—'}</span>, muted: true },
      ]}
      detail={rec => (
        <div className="space-y-5">
          <Components productId={rec.id} />
          <div className="border-t border-[#E5E7EB] pt-3">
            <p className="text-[12px] font-medium text-neutral-700 mb-1">Public pages</p>
            <PublicPage productId={rec.id} kind="changelog" title="Changelog" hint="Released versions and their notes, for customers." />
            <PublicPage productId={rec.id} kind="status" title="Status page" hint="Whether the product is working, and any ongoing incidents." />
          </div>
        </div>
      )}
    />
  );
}
