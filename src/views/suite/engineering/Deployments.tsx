'use client';

import React, { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi, useRecords, type Rec } from '@/lib/suite/useRecords';
import { Badge, Button, ago, type Tone } from '@/components/suite/ui';
import { RecordsTab, opts, type FieldDef } from '@/components/suite/records';

export const ENV_ORDER = ['production', 'staging', 'preview', 'development'];
export const STATE_TONE: Record<string, Tone> = { ready: 'green', error: 'red', building: 'amber', queued: 'neutral', canceled: 'neutral' };

const FIELDS: FieldDef[] = [
  { name: 'projectName', label: 'App / project', required: true, half: true },
  { name: 'environment', label: 'Environment', type: 'select', required: true, options: opts(ENV_ORDER), half: true },
  { name: 'state', label: 'Result', type: 'select', required: true, options: opts(['ready', 'error', 'building', 'canceled'], { ready: 'Succeeded', error: 'Failed' }), half: true },
  { name: 'version', label: 'Version', placeholder: 'v2.4.0', half: true },
  { name: 'url', label: 'URL', type: 'url', placeholder: 'https://' },
  { name: 'branch', label: 'Branch', half: true },
  { name: 'commitSha', label: 'Commit', half: true },
  { name: 'commitMessage', label: 'Commit message' },
  { name: 'deployedAt', label: 'Deployed on', type: 'date', half: true },
];

function LiveNow({ items }: { items: Rec[] }) {
  // Latest successful production deployment of every app
  const live = useMemo(() => {
    const seen = new Map<string, Rec>();
    for (const d of items) if (d.environment === 'production' && d.state === 'ready' && !seen.has(d.projectName)) seen.set(d.projectName, d);
    return Array.from(seen.values());
  }, [items]);
  if (!live.length) return null;
  return (
    <div className="mb-5">
      <p className="text-[12px] font-medium text-neutral-700 mb-2">Live in production</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {live.map(d => (
          <div key={d.id} className="border border-[#E5E7EB] rounded-xl px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-[13px] font-medium truncate">{d.projectName}</span>
              {d.version && <Badge>{d.version}</Badge>}
            </div>
            <p className="text-[11.5px] text-neutral-500 mt-1 truncate">
              {d.commitMessage || d.branch || 'Deployed'} · {ago(d.deployedAt)}
            </p>
            {d.url && (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-[#2563EB] hover:underline truncate block mt-0.5">
                {d.url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Deployments() {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const recent = useRecords<Rec>('deployments', {}, { limit: 100 });

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await suiteApi<{ deployments?: number; skipped?: boolean }>('/api/suite/integrations', { method: 'PUT', body: JSON.stringify({ provider: 'vercel' }) });
      toast.success(res.skipped ? 'Already up to date (synced in the last minute)' : `${res.deployments ?? 0} deployments synced from Vercel`);
      void recent.reload(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[12.5px] text-neutral-500">Deployments from Vercel appear automatically after a sync. Other hosts can be logged by hand.</p>
        <Button onClick={sync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync from Vercel'}</Button>
      </div>
      <LiveNow items={recent.items} />
      <RecordsTab
        entity="deployments"
        noun="Deployment"
        fields={FIELDS}
        defaults={{ environment: 'production', state: 'ready' }}
        filterBar={[
          { key: 'environment', label: 'Environments', options: opts(ENV_ORDER) },
          { key: 'state', label: 'Results', options: opts(['ready', 'error', 'building', 'canceled'], { ready: 'Succeeded', error: 'Failed' }) },
        ]}
        empty={{ title: 'No deployments yet', hint: 'Connect Vercel in the Settings tab, or log a deployment by hand.' }}
        columns={[
          { head: 'App', render: r => <span className="font-medium">{r.projectName}</span> },
          { head: 'Environment', render: r => <Badge tone={r.environment === 'production' ? 'blue' : 'neutral'}>{r.environment}</Badge> },
          { head: 'Result', render: r => <Badge tone={STATE_TONE[r.state] ?? 'neutral'}>{r.state === 'ready' ? 'Succeeded' : r.state === 'error' ? 'Failed' : r.state}</Badge> },
          { head: 'Change', render: r => <span className="line-clamp-1">{r.commitMessage || r.branch || r.version || '—'}</span>, muted: true },
          { head: 'By', render: r => r.creator || (r.provider === 'manual' ? 'Logged' : '—'), muted: true },
          { head: 'When', render: r => ago(r.deployedAt), muted: true },
        ]}
      />
    </div>
  );
}
