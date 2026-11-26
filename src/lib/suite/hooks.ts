/**
 * src/lib/suite/hooks.ts — side effects after a suite record is created (never throw).
 *
 *   incidents  SEV1 / SEV2 → whoever is on call now is notified, and connected chat channels get a message
 *   tickets    the assignee is notified
 */
import prisma from '@/lib/prisma';
import type { SuiteContext } from '@/lib/suite/server';
import { postToChat } from '@/lib/suite/integrations';

async function notify(userIds: string[], type: string, title: string, body: string) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  await prisma.notification.createMany({ data: unique.map(userId => ({ userId, type, title, body })) }).catch(() => {});
}

export async function onCallNow(teamId: string): Promise<string[]> {
  const now = new Date();
  const shifts = await prisma.onCallShift.findMany({
    where: { teamId, startsAt: { lte: now }, endsAt: { gte: now } },
    select: { userId: true },
    take: 20,
  });
  return shifts.map(s => s.userId);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function afterCreate(entity: string, rec: any, ctx: SuiteContext): Promise<void> {
  try {
    if (entity === 'incidents' && (rec.severity === 'sev1' || rec.severity === 'sev2')) {
      const title = `${String(rec.severity).toUpperCase()} incident: ${rec.title}`;
      if (ctx.settings.notifyOnCallForSev1) {
        const onCall = await onCallNow(ctx.teamId);
        const managers = rec.severity === 'sev1'
          ? (await prisma.teamMembership.findMany({ where: { teamId: ctx.teamId, role: 'Admin' }, select: { userId: true }, take: 20 })).map(m => m.userId)
          : [];
        await notify([...onCall, ...managers, rec.ownerId].filter(u => u && u !== ctx.userId), 'incident', title, 'Open Engineering → Incidents to respond.');
      }
      await postToChat(ctx.teamId, `🚨 ${title}`);
    }
    if (entity === 'tickets' && rec.assigneeId && rec.assigneeId !== ctx.userId) {
      await notify([rec.assigneeId], 'ticket_assigned', `Support ticket: ${rec.subject}`, `Priority ${rec.priority}. Open Customers → Support.`);
    }
  } catch (err) {
    console.warn('[suite/hooks] afterCreate failed', entity, (err as Error)?.message);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
