'use client';

/**
 * Engineering → Settings: connections (GitHub, Vercel, Slack, Microsoft Teams, Discord) and
 * company automations. Connecting and disconnecting is for company Admins only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi } from '@/lib/suite/useRecords';
import { refreshSuite, useSuite } from '@/lib/suite/useSuite';
import { Badge, Button, Field, Input, SectionHeader, ago } from '@/components/suite/ui';

interface Connection {
  provider: string;
  status: string;
  accountLabel: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

const PROVIDERS: { id: string; name: string; what: string; secretLabel: string; help: string }[] = [
  {
    id: 'github', name: 'GitHub', what: 'Pull requests linked to work items by key (TF-123), review and check status, automatic status changes.',
    secretLabel: 'Fine-grained personal access token',
    help: 'GitHub → Settings → Developer settings → Fine-grained tokens. Give read-only access to Pull requests, Commit statuses and Metadata for your repos.',
  },
  {
    id: 'vercel', name: 'Vercel', what: 'Deployment history for every environment and what is live in production.',
    secretLabel: 'Access token',
    help: 'Vercel → Account settings → Tokens. Add your team id below if the projects belong to a Vercel team.',
  },
  { id: 'slack', name: 'Slack', what: 'Releases, won deals and serious incidents posted to a channel.', secretLabel: 'Incoming webhook URL', help: 'Slack → Apps → Incoming Webhooks → Add to a channel → copy the URL.' },
  { id: 'teams', name: 'Microsoft Teams', what: 'The same alerts in a Teams channel.', secretLabel: 'Incoming webhook URL', help: 'Teams channel → Workflows → “Post to a channel when a webhook request is received” → copy the URL.' },
  { id: 'discord', name: 'Discord', what: 'The same alerts in a Discord channel.', secretLabel: 'Webhook URL', help: 'Discord → Channel settings → Integrations → Webhooks → copy the URL.' },
];

const AUTOMATIONS: { key: string; label: string }[] = [
  { key: 'autoReviewOnPrOpen', label: 'Move an item to In review when its pull request opens' },
  { key: 'autoDoneOnPrMerge', label: 'Move an item to Done when its pull request is merged' },
  { key: 'launchChecklistOnRelease', label: 'Start the marketing launch checklist when a version is released' },
  { key: 'projectOnDealWon', label: 'Create the client project and backlog when a deal is won' },
  { key: 'notifyOnCallForSev1', label: 'Alert whoever is on call for SEV1 and SEV2 incidents' },
];

export default function EngineeringSettings() {
  const toast = useToast();
  const { suite } = useSuite();
  const [data, setData] = useState<{ connections: Connection[]; canManage: boolean; githubWebhookUrl: string } | null>(null);
  const [form, setForm] = useState<{ provider: string; secret: string; vercelTeamId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);

  const load = useCallback(() => suiteApi('/api/suite/integrations').then(setData).catch(() => {}), []);
  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const res = await suiteApi<{ accountLabel: string; webhookSecret?: string }>('/api/suite/integrations', {
        method: 'POST',
        body: JSON.stringify({ provider: form.provider, secret: form.secret.trim(), ...(form.vercelTeamId ? { vercelTeamId: form.vercelTeamId.trim() } : {}) }),
      });
      toast.success(`Connected as ${res.accountLabel}`);
      if (res.webhookSecret) setWebhookSecret(res.webhookSecret);
      setForm(null);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (provider: string) => {
    try {
      await suiteApi(`/api/suite/integrations?provider=${provider}`, { method: 'DELETE' });
      toast.success('Disconnected');
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const sync = async (provider: string) => {
    try {
      const res = await suiteApi<{ skipped?: boolean; pulls?: number; linked?: number; deployments?: number }>('/api/suite/integrations', { method: 'PUT', body: JSON.stringify({ provider }) });
      toast.success(res.skipped ? 'Synced less than a minute ago' : provider === 'github' ? `${res.pulls ?? 0} pull requests checked, ${res.linked ?? 0} linked to work items` : `${res.deployments ?? 0} deployments synced`);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = async (key: string, value: boolean) => {
    try {
      await suiteApi('/api/suite/context', { method: 'PATCH', body: JSON.stringify({ settings: { [key]: value } }) });
      refreshSuite();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const canManage = Boolean(data?.canManage);

  return (
    <div className="space-y-8 max-w-3xl">
      <section>
        <SectionHeader title="Connections" hint={canManage ? 'Tokens are checked with the provider and stored encrypted. They are never shown again.' : 'Only company Admins can connect services.'} />
        <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
          {PROVIDERS.map(p => {
            const c = data?.connections.find(x => x.provider === p.id);
            const open = form?.provider === p.id;
            return (
              <li key={p.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium">{p.name}</span>
                      {c ? <Badge tone={c.status === 'error' ? 'red' : 'green'}>{c.status === 'error' ? 'Needs attention' : 'Connected'}</Badge> : <Badge>Not connected</Badge>}
                    </div>
                    <p className="text-[12px] text-neutral-500 mt-0.5">{c ? `${c.accountLabel}${c.lastSyncAt ? ` · synced ${ago(c.lastSyncAt)}` : ''}` : p.what}</p>
                    {c?.lastError && <p className="text-[12px] text-red-600 mt-0.5">{c.lastError}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {c && (p.id === 'github' || p.id === 'vercel') && <Button size="sm" onClick={() => sync(p.id)}>Sync now</Button>}
                    {canManage && !open && <Button size="sm" variant={c ? 'ghost' : 'secondary'} onClick={() => setForm({ provider: p.id, secret: '', vercelTeamId: '' })}>{c ? 'Replace' : 'Connect'}</Button>}
                    {canManage && c && <Button size="sm" variant="danger" onClick={() => disconnect(p.id)}>Disconnect</Button>}
                  </div>
                </div>
                {open && form && (
                  <div className="mt-3 space-y-2.5">
                    <Field label={p.secretLabel} hint={p.help}>
                      <Input type="password" autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} />
                    </Field>
                    {p.id === 'vercel' && (
                      <Field label="Vercel team id (optional)">
                        <Input value={form.vercelTeamId} onChange={e => setForm({ ...form, vercelTeamId: e.target.value })} placeholder="team_…" />
                      </Field>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancel</Button>
                      <Button variant="primary" size="sm" onClick={connect} disabled={busy || form.secret.trim().length < 8}>{busy ? 'Checking…' : 'Connect'}</Button>
                    </div>
                  </div>
                )}
                {p.id === 'github' && c && canManage && (
                  <details className="mt-2">
                    <summary className="text-[12px] text-[#2563EB] cursor-pointer">Instant updates with a GitHub webhook (optional)</summary>
                    <div className="mt-2 text-[12px] text-neutral-600 space-y-1.5">
                      <p>In each repo: Settings → Webhooks → Add webhook. Content type <code>application/json</code>, events: Pull requests.</p>
                      <p>Payload URL: <code className="break-all bg-neutral-50 px-1 rounded">{data?.githubWebhookUrl}</code></p>
                      {webhookSecret ? (
                        <p>Secret (copy it now — it is shown only once): <code className="break-all bg-amber-50 px-1 rounded">{webhookSecret}</code></p>
                      ) : (
                        <p>The secret was shown when GitHub was connected. Use Replace to get a new one.</p>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeader title="Automations" hint={suite?.me?.isAdmin ? 'Company-wide. Turn off anything your team prefers to do by hand.' : 'Only company Admins can change these.'} />
        <ul className="divide-y divide-[#F1F1F1] border border-[#E5E7EB] rounded-xl">
          {AUTOMATIONS.map(a => (
            <li key={a.key} className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-[13px]">{a.label}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={a.label}
                disabled={!suite?.me?.isAdmin}
                checked={Boolean(suite?.settings?.[a.key])}
                onChange={e => toggle(a.key, e.target.checked)}
                className="w-4 h-4 accent-[#2563EB] cursor-pointer disabled:cursor-not-allowed"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
