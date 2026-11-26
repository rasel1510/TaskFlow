/**
 * src/lib/suite/integrations.ts — GitHub, Vercel and chat (Slack / Microsoft Teams / Discord).
 *
 * Security:
 *   - tokens and webhook URLs are verified with the provider before they are saved, then stored
 *     only encrypted (AES-256-GCM, see suite/server.ts); they are never sent back to the browser
 *   - outgoing requests go only to fixed hosts (api.github.com, api.vercel.com) or to chat webhook
 *     URLs on the providers' own domains — never to an arbitrary address
 *   - GitHub webhooks are accepted only with a valid HMAC-SHA256 signature
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { decryptSecret, encryptSecret, DEFAULT_SETTINGS, type SuiteSettings } from '@/lib/suite/server';

export const PROVIDERS = ['github', 'vercel', 'slack', 'teams', 'discord'] as const;
export type Provider = (typeof PROVIDERS)[number];
export const CHAT_PROVIDERS: Provider[] = ['slack', 'teams', 'discord'];

const TASK_KEY = /\bTF-(\d{1,7})\b/i;
const TIMEOUT_MS = 12_000;

async function http(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

/* ───────────────────────────────── chat webhooks ───────────────────────────────── */

export function isChatWebhook(provider: Provider, raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (provider === 'slack') return host === 'hooks.slack.com' && u.pathname.startsWith('/services/');
  if (provider === 'discord') return (host === 'discord.com' || host === 'discordapp.com') && u.pathname.startsWith('/api/webhooks/');
  if (provider === 'teams') return host.endsWith('.webhook.office.com') || host.endsWith('.logic.azure.com') || host.endsWith('.powerplatform.com');
  return false;
}

/** Posts a short message to every chat channel the company connected. Never throws. */
export async function postToChat(teamId: string, text: string): Promise<void> {
  try {
    const rows = await prisma.integration.findMany({ where: { teamId, provider: { in: CHAT_PROVIDERS }, status: 'connected' } });
    await Promise.all(
      rows.map(async row => {
        const url = decryptSecret(row.secretEnc);
        if (!isChatWebhook(row.provider as Provider, url)) return;
        const body = row.provider === 'discord' ? { content: text } : { text };
        await http(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
      })
    );
  } catch (err) {
    console.warn('[integrations] chat post failed', (err as Error)?.message);
  }
}

/* ───────────────────────────────── connect ───────────────────────────────── */

export interface ConnectResult {
  accountLabel: string;
  config?: Record<string, unknown>;
  webhookSecret?: string;
}

export async function verifyAndDescribe(provider: Provider, secret: string, opts: { vercelTeamId?: string } = {}): Promise<ConnectResult> {
  if (provider === 'github') {
    const res = await http('https://api.github.com/user', { headers: githubHeaders(secret) });
    if (res.status === 401) throw new Error('GitHub rejected this token.');
    if (!res.ok) throw new Error(`GitHub answered ${res.status}. Please try again.`);
    const me = (await res.json()) as { login?: string };
    return { accountLabel: me.login ? `@${me.login}` : 'GitHub', webhookSecret: crypto.randomBytes(24).toString('hex') };
  }
  if (provider === 'vercel') {
    const res = await http('https://api.vercel.com/v2/user', { headers: { Authorization: `Bearer ${secret}` } });
    if (res.status === 401 || res.status === 403) throw new Error('Vercel rejected this token.');
    if (!res.ok) throw new Error(`Vercel answered ${res.status}. Please try again.`);
    const me = (await res.json()) as { user?: { username?: string } };
    const teamId = opts.vercelTeamId?.trim();
    if (teamId && !/^[\w-]{3,64}$/.test(teamId)) throw new Error('That Vercel team id does not look right.');
    return { accountLabel: me.user?.username ? `@${me.user.username}${teamId ? ` · ${teamId}` : ''}` : 'Vercel', config: teamId ? { teamId } : {} };
  }
  if (!isChatWebhook(provider, secret)) throw new Error(`That is not a ${provider === 'teams' ? 'Microsoft Teams' : provider} incoming webhook URL.`);
  const res = await http(secret, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(provider === 'discord' ? { content: 'FlowSync is connected ✅' } : { text: 'FlowSync is connected ✅' }),
  });
  if (!res.ok) throw new Error(`The webhook answered ${res.status}. Check the URL and try again.`);
  return { accountLabel: provider === 'teams' ? 'Microsoft Teams channel' : `${provider[0].toUpperCase()}${provider.slice(1)} channel` };
}

export function sealForStorage(secret: string, webhookSecret?: string) {
  return { secretEnc: encryptSecret(secret), webhookSecretEnc: webhookSecret ? encryptSecret(webhookSecret) : null };
}

/* ───────────────────────────────── GitHub ───────────────────────────────── */

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'FlowSync',
  };
}

interface GhPull {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed';
  draft?: boolean;
  merged_at: string | null;
  user?: { login?: string };
  head?: { ref?: string; sha?: string };
}

async function taskIdsByNumber(teamId: string, numbers: string[]): Promise<Map<string, { id: string; status: string }>> {
  if (!numbers.length) return new Map();
  const tasks = await prisma.task.findMany({
    where: { taskNumber: { in: numbers }, project: { teamId } },
    select: { id: true, taskNumber: true, status: true },
  });
  return new Map(tasks.map(t => [String(t.taskNumber).toUpperCase(), { id: t.id, status: t.status }]));
}

function keyOf(pr: Pick<GhPull, 'title' | 'body' | 'head'>): string | null {
  const m = `${pr.head?.ref ?? ''} ${pr.title} ${pr.body ?? ''}`.match(TASK_KEY);
  return m ? `TF-${m[1].padStart(3, '0')}`.toUpperCase() : null;
}

/** Saves pull requests as CodeLinks, links them to work items and applies the status automations. */
export async function upsertPulls(teamId: string, repo: string, pulls: GhPull[], settings: SuiteSettings, extras: Map<number, { checks?: string | null; review?: string | null }> = new Map()) {
  const keys = pulls.map(keyOf).filter((k): k is string => Boolean(k));
  const tasks = await taskIdsByNumber(teamId, Array.from(new Set(keys)));
  const s = { ...DEFAULT_SETTINGS, ...settings };
  let linked = 0;
  for (const pr of pulls) {
    const key = keyOf(pr);
    const task = key ? tasks.get(key) : undefined;
    const state = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open';
    const extra = extras.get(pr.number) ?? {};
    await prisma.codeLink.upsert({
      where: { teamId_provider_externalId: { teamId, provider: 'github', externalId: `pr:${pr.id}` } },
      create: {
        teamId, provider: 'github', kind: 'pull_request', externalId: `pr:${pr.id}`, repo, number: pr.number,
        title: pr.title.slice(0, 300), url: pr.html_url, state, author: pr.user?.login ?? null, branch: pr.head?.ref ?? null,
        taskId: task?.id ?? null, mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        checks: extra.checks ?? null, reviewState: extra.review ?? null,
      },
      update: {
        title: pr.title.slice(0, 300), state, branch: pr.head?.ref ?? null, taskId: task?.id ?? null,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        ...(extras.has(pr.number) ? { checks: extra.checks ?? null, reviewState: extra.review ?? null } : {}),
      },
    });
    if (!task) continue;
    linked++;
    // Automations: PR opened → In review, merged → Done (never moves an item backwards)
    if (state === 'merged' && s.autoDoneOnPrMerge && task.status !== 'done') {
      await prisma.task.update({ where: { id: task.id }, data: { status: 'done', completedAt: new Date() } });
      task.status = 'done';
    } else if (state === 'open' && s.autoReviewOnPrOpen && ['backlog', 'todo', 'in_progress'].includes(task.status)) {
      await prisma.task.update({ where: { id: task.id }, data: { status: 'in_review' } });
      task.status = 'in_review';
    }
  }
  return linked;
}

async function githubExtras(token: string, repo: string, pulls: GhPull[]) {
  const extras = new Map<number, { checks?: string | null; review?: string | null }>();
  const open = pulls.filter(p => p.state === 'open').slice(0, 15);
  await Promise.all(
    open.map(async p => {
      try {
        const [st, rv] = await Promise.all([
          p.head?.sha ? http(`https://api.github.com/repos/${repo}/commits/${p.head.sha}/status`, { headers: githubHeaders(token) }) : null,
          http(`https://api.github.com/repos/${repo}/pulls/${p.number}/reviews?per_page=50`, { headers: githubHeaders(token) }),
        ]);
        const status = st && st.ok ? ((await st.json()) as { state?: string; total_count?: number }) : null;
        const reviews = rv.ok ? ((await rv.json()) as { state: string }[]) : [];
        const last = [...reviews].reverse().find(r => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED');
        extras.set(p.number, {
          checks: status && status.total_count ? (status.state === 'success' ? 'success' : status.state === 'failure' || status.state === 'error' ? 'failure' : 'pending') : null,
          review: last ? (last.state === 'APPROVED' ? 'approved' : 'changes_requested') : reviews.length ? 'pending' : null,
        });
      } catch {
        /* optional details */
      }
    })
  );
  return extras;
}

export async function syncGithub(teamId: string, settings: SuiteSettings): Promise<{ repos: number; pulls: number; linked: number }> {
  const row = await prisma.integration.findUnique({ where: { teamId_provider: { teamId, provider: 'github' } } });
  if (!row) throw new Error('GitHub is not connected.');
  const token = decryptSecret(row.secretEnc);
  const comps = await prisma.productComponent.findMany({ where: { teamId, repoFullName: { not: null } }, select: { repoFullName: true }, take: 30 });
  const repos = Array.from(new Set(comps.map(c => c.repoFullName!).filter(r => /^[\w.-]+\/[\w.-]+$/.test(r))));
  let pulls = 0;
  let linked = 0;
  const errors: string[] = [];
  for (const repo of repos) {
    const res = await http(`https://api.github.com/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`, { headers: githubHeaders(token) });
    if (!res.ok) {
      errors.push(`${repo}: ${res.status === 404 ? 'not found or no access' : `GitHub ${res.status}`}`);
      continue;
    }
    const list = (await res.json()) as GhPull[];
    pulls += list.length;
    linked += await upsertPulls(teamId, repo, list, settings, await githubExtras(token, repo, list));
  }
  await prisma.integration.update({
    where: { id: row.id },
    data: { lastSyncAt: new Date(), lastError: errors.length ? errors.join('; ').slice(0, 500) : null, status: errors.length && !pulls ? 'error' : 'connected' },
  });
  return { repos: repos.length, pulls, linked };
}

/** GitHub webhook (pull_request events). Returns true when the signature was valid. */
export async function handleGithubWebhook(teamId: string, raw: string, signature: string | null, event: string | null): Promise<'ok' | 'ignored' | 'unauthorized'> {
  const row = await prisma.integration.findUnique({ where: { teamId_provider: { teamId, provider: 'github' } } });
  if (!row?.webhookSecretEnc || !signature) return 'unauthorized';
  const expected = `sha256=${crypto.createHmac('sha256', decryptSecret(row.webhookSecretEnc)).update(raw).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'unauthorized';
  if (event !== 'pull_request') return 'ignored';
  const payload = JSON.parse(raw) as { pull_request?: GhPull; repository?: { full_name?: string } };
  if (!payload.pull_request || !payload.repository?.full_name) return 'ignored';
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { suiteSettings: true } });
  await upsertPulls(teamId, payload.repository.full_name, [payload.pull_request], (team?.suiteSettings as SuiteSettings | null) || {});
  await prisma.auditLog.create({ data: { teamId, action: 'github.webhook', target: payload.repository.full_name } }).catch(() => {});
  return 'ok';
}

/* ───────────────────────────────── Vercel ───────────────────────────────── */

interface VercelDeployment {
  uid: string;
  name: string;
  url?: string;
  created: number;
  ready?: number;
  state?: string;
  readyState?: string;
  target?: string | null;
  projectId?: string;
  creator?: { username?: string };
  meta?: { githubCommitSha?: string; githubCommitMessage?: string; githubCommitRef?: string };
}

export async function syncVercel(teamId: string): Promise<{ deployments: number }> {
  const row = await prisma.integration.findUnique({ where: { teamId_provider: { teamId, provider: 'vercel' } } });
  if (!row) throw new Error('Vercel is not connected.');
  const token = decryptSecret(row.secretEnc);
  const vercelTeam = (row.config as { teamId?: string } | null)?.teamId;
  const qs = new URLSearchParams({ limit: '50', ...(vercelTeam ? { teamId: vercelTeam } : {}) });
  const res = await http(`https://api.vercel.com/v6/deployments?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    await prisma.integration.update({ where: { id: row.id }, data: { status: 'error', lastError: `Vercel answered ${res.status}`, lastSyncAt: new Date() } });
    throw new Error(res.status === 403 ? 'Vercel refused access — check the token scope / team id.' : `Vercel answered ${res.status}.`);
  }
  const { deployments = [] } = (await res.json()) as { deployments?: VercelDeployment[] };
  const comps = await prisma.productComponent.findMany({ where: { teamId, vercelProjectId: { not: null } }, select: { id: true, vercelProjectId: true } });
  const compFor = (d: VercelDeployment) => comps.find(c => c.vercelProjectId === d.projectId || c.vercelProjectId === d.name)?.id ?? null;

  for (const d of deployments) {
    const state = String(d.readyState || d.state || 'READY').toLowerCase();
    const data = {
      componentId: compFor(d),
      projectName: d.name.slice(0, 120),
      environment: d.target === 'production' ? 'production' : d.target === 'staging' ? 'staging' : 'preview',
      state: ['ready', 'error', 'building', 'queued', 'canceled', 'initializing'].includes(state) ? (state === 'initializing' ? 'building' : state) : 'ready',
      url: d.url ? `https://${d.url}` : null,
      commitSha: d.meta?.githubCommitSha ?? null,
      commitMessage: d.meta?.githubCommitMessage?.slice(0, 300) ?? null,
      branch: d.meta?.githubCommitRef ?? null,
      creator: d.creator?.username ?? null,
      deployedAt: new Date(d.created),
      readyAt: d.ready ? new Date(d.ready) : null,
    };
    await prisma.deployment.upsert({
      where: { teamId_provider_externalId: { teamId, provider: 'vercel', externalId: d.uid } },
      create: { teamId, provider: 'vercel', externalId: d.uid, ...data },
      update: data,
    });
  }
  await prisma.integration.update({ where: { id: row.id }, data: { lastSyncAt: new Date(), lastError: null, status: 'connected' } });
  return { deployments: deployments.length };
}
