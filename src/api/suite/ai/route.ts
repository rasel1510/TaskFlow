/**
 * src/api/suite/ai/route.ts — POST /api/suite/ai  { task, id, projectId? }
 *
 *   stories_from_doc  (Engineering) requirements document → backlog stories in a project
 *   release_notes     (Engineering) rewrite a release's notes for customers
 *   draft_content     (Marketing)   first draft of a content item (uses release notes for launches)
 *   summarize_deal    (Sales)       short deal summary with next steps
 *   reply_ticket      (Customers)   suggested reply to a support ticket
 *
 * Uses the same AI provider as FlowAi (OpenRouter) and the same hourly limit per person.
 * Only records of the open company are read; the AI never receives other companies' data.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireSuite, fail, ok, audit } from '@/lib/suite/server';
import { overLimit, HOUR } from '@/lib/abuseGuard';
import type { SuiteModule } from '@/lib/suite/departments';

export const dynamic = 'force-dynamic';

const TASKS: Record<string, SuiteModule> = {
  stories_from_doc: 'engineering',
  release_notes: 'engineering',
  draft_content: 'marketing',
  summarize_deal: 'sales',
  reply_ticket: 'customers',
};

const Schema = z.object({
  task: z.enum(['stories_from_doc', 'release_notes', 'draft_content', 'summarize_deal', 'reply_ticket']),
  id: z.string().trim().min(1).max(60),
  projectId: z.string().trim().max(60).optional(),
});

async function complete(system: string, user: string, json = false): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('AI is not configured on this server (OPENROUTER_API_KEY).');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://flowsync.app', 'X-Title': 'FlowAi' },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 1200,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user.slice(0, 24_000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`The AI service answered ${res.status}.`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(t);
  }
}

const PLAIN = 'Write in clear, simple, professional English. No hype, no emojis. Never invent facts that are not in the input.';

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'VALIDATION', 'Invalid request');
  const { task, id, projectId } = parsed.data;
  const access = await requireSuite(TASKS[task]);
  if (!access.ok) return access.response;
  const ctx = access.value;
  if (await overLimit('copilot', ctx.userId, 60, HOUR)) return fail(429, 'RATE_LIMITED', 'You reached the hourly AI limit. Please try again later.');

  try {
    if (task === 'stories_from_doc') {
      const doc = await prisma.docPage.findFirst({ where: { id, teamId: ctx.teamId }, select: { title: true, body: true } });
      if (!doc) return fail(404, 'NOT_FOUND', 'Document not found');
      const project = projectId ? await prisma.project.findFirst({ where: { id: projectId, teamId: ctx.teamId }, select: { id: true } }) : null;
      if (!project) return fail(400, 'BAD_LINK', 'Choose a project for the new stories.');
      const out = await complete(
        `${PLAIN} You turn product requirements into user stories for a software team. Reply with JSON: {"stories":[{"title":"As a … I want … so that …","points":1|2|3|5|8}]}. At most 15 stories, each small enough for one sprint.`,
        `Document: ${doc.title}\n\n${doc.body}`,
        true
      );
      let stories: { title: string; points?: number }[] = [];
      try {
        stories = (JSON.parse(out).stories || []).filter((s: { title?: unknown }) => typeof s.title === 'string' && s.title.trim()).slice(0, 15);
      } catch {
        return fail(502, 'AI_FORMAT', 'The AI answer could not be read. Please try again.');
      }
      if (!stories.length) return fail(422, 'NOTHING', 'No stories could be found in this document.');
      const count = await prisma.task.count();
      await prisma.task.createMany({
        data: stories.map((s, i) => ({
          taskNumber: `TF-${String(count + i + 1).padStart(3, '0')}`,
          title: s.title.trim().slice(0, 300),
          projectId: project.id,
          creatorId: ctx.userId,
          status: 'backlog' as const,
          itemType: 'story',
          storyPoints: [1, 2, 3, 5, 8].includes(Number(s.points)) ? Number(s.points) : null,
        })),
      });
      await audit(ctx, 'ai.stories', id, { count: stories.length });
      return ok({ text: stories.map(s => `• ${s.title}`).join('\n'), created: stories.length });
    }

    if (task === 'release_notes') {
      const release = await prisma.release.findFirst({ where: { id, teamId: ctx.teamId } });
      if (!release) return fail(404, 'NOT_FOUND', 'Release not found');
      const items = await prisma.task.findMany({ where: { releaseId: id, status: 'done', project: { teamId: ctx.teamId } }, select: { title: true, itemType: true }, take: 200 });
      const source = release.notes || items.map(i => `- [${i.itemType}] ${i.title}`).join('\n');
      if (!source.trim()) return fail(422, 'NOTHING', 'Link completed work items or write notes first.');
      const text = await complete(
        `${PLAIN} Rewrite release notes for customers. Keep Markdown with "### New", "### Fixed", "### Improved" sections and short bullet points. Explain the benefit to the user, not internal details. Do not include ticket numbers.`,
        `Version ${release.version}${release.title ? ` — ${release.title}` : ''}\n\n${source}`
      );
      const notes = `## ${release.version}${release.title ? ` — ${release.title}` : ''}\n\n${text.replace(/^##[^\n]*\n+/, '')}`.slice(0, 20000);
      await prisma.release.update({ where: { id }, data: { notes } });
      await audit(ctx, 'ai.release_notes', id);
      return ok({ text: notes });
    }

    if (task === 'draft_content') {
      const item = await prisma.contentItem.findFirst({ where: { id, teamId: ctx.teamId } });
      if (!item) return fail(404, 'NOT_FOUND', 'Content not found');
      const release = item.releaseId ? await prisma.release.findFirst({ where: { id: item.releaseId, teamId: ctx.teamId }, select: { version: true, notes: true } }) : null;
      const text = await complete(
        `${PLAIN} You are a B2B software marketer. Write a first draft for the channel "${item.channel}" (blog: ~300 words with a title; social: 2 short post options; email: subject line + ~150 words; announcement: ~120 words).`,
        `Topic: ${item.title}\n${item.notes ? `Brief: ${item.notes}\n` : ''}${release ? `Release ${release.version} notes:\n${release.notes}` : ''}`
      );
      await prisma.contentItem.update({ where: { id }, data: { notes: `${text}\n\n---\n${item.notes}`.slice(0, 5000), stage: item.stage === 'idea' ? 'writing' : item.stage } });
      await audit(ctx, 'ai.draft_content', id);
      return ok({ text });
    }

    if (task === 'summarize_deal') {
      const deal = await prisma.deal.findFirst({ where: { id, teamId: ctx.teamId }, include: { activities: { select: { type: true, subject: true, dueAt: true, doneAt: true }, orderBy: { createdAt: 'desc' }, take: 30 } } });
      if (!deal) return fail(404, 'NOT_FOUND', 'Deal not found');
      const text = await complete(
        `${PLAIN} Summarise a sales deal in 3–5 short bullet points, then give "Next steps:" with 2–3 concrete actions.`,
        `Deal: ${deal.title}\nCompany: ${deal.companyName}\nStage: ${deal.stage}\nValue: ${deal.valueCents / 100} ${deal.currency}\nNext step: ${deal.nextStep}\nRequirements:\n${deal.requirements}\nActivities:\n${deal.activities.map(a => `- ${a.type}: ${a.subject}${a.doneAt ? ' (done)' : ''}`).join('\n')}`
      );
      await audit(ctx, 'ai.summarize_deal', id);
      return ok({ text });
    }

    // reply_ticket
    const ticket = await prisma.ticket.findFirst({ where: { id, teamId: ctx.teamId }, select: { subject: true, description: true, priority: true, status: true, bugTaskId: true } });
    if (!ticket) return fail(404, 'NOT_FOUND', 'Ticket not found');
    const text = await complete(
      `${PLAIN} You are a friendly, professional customer support agent for a software company. Write a short reply to the customer (under 120 words). Acknowledge the problem, say what happens next, and do not promise dates.`,
      `Subject: ${ticket.subject}\nPriority: ${ticket.priority}\n${ticket.bugTaskId ? 'Engineering is already working on a fix.\n' : ''}Message:\n${ticket.description}`
    );
    await audit(ctx, 'ai.reply_ticket', id);
    return ok({ text });
  } catch (e) {
    console.error('[POST /api/suite/ai]', task, (e as Error)?.message);
    return fail(502, 'AI_FAILED', (e as Error).message.includes('configured') ? (e as Error).message : 'The AI could not answer right now. Please try again.');
  }
}
