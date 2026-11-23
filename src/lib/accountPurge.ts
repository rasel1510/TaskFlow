/**
 * src/lib/accountPurge.ts
 *
 * Permanent deletion used by the Super Admin console. Everything is removed from the database in
 * one transaction (all or nothing), then Stripe billing is stopped and caches are cleared.
 *
 *   purgeCompany(teamId) — the company, every project and task in it (with comments, activity,
 *                          messages, members, invitations, join requests), and every person in it
 *                          except Super Admins (who are only detached).
 *   purgeUser(userId)    — one person and all of their data. Projects they own in a company that
 *                          still exists are handed to that company's Admin instead of being deleted,
 *                          so their teammates keep their work.
 *
 * Once deleted, the email can sign up again, and any browser still signed in to a deleted account
 * is signed out on its next request (see the jwt callback in src/auth.ts).
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { stripe } from '@/lib/stripe';
import { isSuperAdmin } from '@/lib/permissions';
import { toCompanyRole } from '@/lib/companyRoles';

type Tx = Prisma.TransactionClient;

/** Interactive transactions default to 5s, too short for a large company on a remote database. */
const TX_OPTIONS = { timeout: 60_000, maxWait: 15_000 };

export interface PurgeSummary {
  users: number;
  projects: number;
  tasks: number;
  projectsReassigned: number;
}

/** Deletes projects (their tasks, comments, activity, messages, members… cascade) and task notifications. */
async function deleteProjects(tx: Tx, projectIds: string[]): Promise<number> {
  if (projectIds.length === 0) return 0;
  const tasks = await tx.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
  const taskIds = tasks.map(t => t.id);
  if (taskIds.length > 0) {
    // Notifications point at tasks without a foreign key — remove them explicitly
    await tx.notification.deleteMany({ where: { taskId: { in: taskIds } } });
    // Break reply chains first so comment deletion never trips over self-references
    await tx.comment.updateMany({ where: { taskId: { in: taskIds }, replyToId: { not: null } }, data: { replyToId: null } });
  }
  await tx.project.deleteMany({ where: { id: { in: projectIds } } });
  return taskIds.length;
}

/**
 * Removes people and everything that is theirs. Projects they own outside `skipTeamId` are given to
 * a remaining Admin (or member) of that project's company; with nobody left, the project is deleted.
 */
async function deletePeople(
  tx: Tx,
  people: { id: string; email: string | null }[],
  skipTeamId?: string
): Promise<{ users: number; projects: number; tasks: number; reassigned: number }> {
  const ids = people.map(p => p.id);
  if (ids.length === 0) return { users: 0, projects: 0, tasks: 0, reassigned: 0 };
  const idSet = new Set(ids);
  const emails = people.map(p => p.email?.toLowerCase().trim()).filter((e): e is string => Boolean(e));
  let projects = 0;
  let tasks = 0;
  let reassigned = 0;

  // 1. Projects they own in other (surviving) companies → hand over or delete
  const owned = await tx.project.findMany({
    where: { ownerId: { in: ids }, ...(skipTeamId ? { NOT: { teamId: skipTeamId } } : {}) },
    select: { id: true, teamId: true, members: { select: { userId: true, role: true } } },
  });
  const orphaned: string[] = [];
  for (const project of owned) {
    let successor: string | null = null;
    if (project.teamId) {
      const admin = await tx.user.findFirst({
        where: { teamId: project.teamId, id: { notIn: ids }, role: { in: ['Admin', 'ADMIN', 'admin'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      successor = admin?.id ?? null;
    }
    if (!successor) {
      const rank = { Admin: 2, 'Project Manager': 1, Member: 0 } as const;
      const remaining = project.members
        .filter(m => !idSet.has(m.userId))
        .sort((a, b) => rank[toCompanyRole(b.role)] - rank[toCompanyRole(a.role)]);
      successor = remaining[0]?.userId ?? null;
    }
    if (!successor) {
      orphaned.push(project.id);
      continue;
    }
    await tx.project.update({ where: { id: project.id }, data: { ownerId: successor } });
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: successor } },
      create: { projectId: project.id, userId: successor, role: 'Admin' },
      update: { role: 'Admin' },
    });
    reassigned++;
  }
  tasks += await deleteProjects(tx, orphaned);
  projects += orphaned.length;

  // 2. Their personal tasks (not in any project)
  const personal = await tx.task.findMany({
    where: { projectId: null, OR: [{ creatorId: { in: ids } }, { assigneeId: { in: ids } }] },
    select: { id: true },
  });
  if (personal.length > 0) {
    const personalIds = personal.map(t => t.id);
    await tx.notification.deleteMany({ where: { taskId: { in: personalIds } } });
    await tx.comment.updateMany({ where: { taskId: { in: personalIds }, replyToId: { not: null } }, data: { replyToId: null } });
    await tx.task.deleteMany({ where: { id: { in: personalIds } } });
    tasks += personalIds.length;
  }

  // 3. Unassign them from other companies' tasks (each field separately — never touch the other person)
  await tx.task.updateMany({ where: { assigneeId: { in: ids } }, data: { assigneeId: null } });
  await tx.task.updateMany({ where: { creatorId: { in: ids } }, data: { creatorId: null } });

  // 4. Their comments (detach replies to them first)
  const theirComments = await tx.comment.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  if (theirComments.length > 0) {
    await tx.comment.updateMany({ where: { replyToId: { in: theirComments.map(c => c.id) } }, data: { replyToId: null } });
    await tx.comment.deleteMany({ where: { userId: { in: ids } } });
  }

  // 5. Invitations sent by them or addressed to them, sign-up codes, and the rest
  await tx.projectInvitation.deleteMany({
    where: { OR: [{ invitedById: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
  });
  await tx.teamInvitation.deleteMany({
    where: { OR: [{ invitedById: { in: ids } }, ...(emails.length ? [{ email: { in: emails } }] : [])] },
  });
  if (emails.length) await tx.verificationCode.deleteMany({ where: { email: { in: emails } } });
  await tx.notification.deleteMany({ where: { userId: { in: ids } } });
  await tx.invoice.deleteMany({ where: { userId: { in: ids } } });
  await tx.projectMessage.deleteMany({ where: { userId: { in: ids } } });
  await tx.projectJoinRequest.deleteMany({ where: { userId: { in: ids } } });
  await tx.projectMember.deleteMany({ where: { userId: { in: ids } } });

  // 6. The accounts themselves
  const deleted = await tx.user.deleteMany({ where: { id: { in: ids } } });
  return { users: deleted.count, projects, tasks, reassigned };
}

/** Stops Stripe billing for deleted accounts (best effort — never blocks the deletion). */
async function cancelBilling(customerIds: (string | null)[]): Promise<void> {
  for (const customerId of new Set(customerIds.filter((c): c is string => Boolean(c)))) {
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
      for (const sub of subs.data) {
        if (!['canceled', 'incomplete_expired'].includes(sub.status)) await stripe.subscriptions.cancel(sub.id);
      }
    } catch (err) {
      console.warn(`[accountPurge] Could not cancel Stripe billing for ${customerId}:`, (err as Error)?.message || err);
    }
  }
}

async function clearCaches(userIds: string[]): Promise<void> {
  await Promise.allSettled([
    redisCache.delPattern('team:*'),
    redisCache.delPattern('projects:*'),
    redisCache.delPattern('project:*'),
    redisCache.delPattern('tasks:*'),
    redisCache.delPattern('notifs:*'),
    redisCache.delPattern('reports:*'),
    redisCache.delPattern('admin:*'),
    ...userIds.flatMap(id => [redisCache.del(`tenant:${id}`), redisCache.del(`user:${id}`)]),
  ]);
}

/** Permanently deletes a company and everything in it. Super Admins in it are only detached. */
export async function purgeCompany(teamId: string): Promise<PurgeSummary> {
  const people = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, email: true, role: true, stripeCustomerId: true, team: { select: { name: true } } },
  });
  const isPlatformOwner = (p: (typeof people)[number]) =>
    isSuperAdmin({ email: p.email, role: p.role, teamName: p.team?.name });
  const toDelete = people.filter(p => !isPlatformOwner(p));
  const toDetach = people.filter(isPlatformOwner).map(p => p.id);

  const summary = await prisma.$transaction(async tx => {
    const projectIds = (await tx.project.findMany({ where: { teamId }, select: { id: true } })).map(p => p.id);
    const tasks = await deleteProjects(tx, projectIds);
    const people = await deletePeople(tx, toDelete, teamId);
    if (toDetach.length) await tx.user.updateMany({ where: { id: { in: toDetach } }, data: { teamId: null } });
    await tx.teamInvitation.deleteMany({ where: { teamId } });
    await tx.team.delete({ where: { id: teamId } });
    return {
      users: people.users,
      projects: projectIds.length + people.projects,
      tasks: tasks + people.tasks,
      projectsReassigned: people.reassigned,
    };
  }, TX_OPTIONS);

  await cancelBilling(toDelete.map(p => p.stripeCustomerId));
  await clearCaches(people.map(p => p.id));
  return summary;
}

/** Permanently deletes one person and everything that is theirs. */
export async function purgeUser(userId: string): Promise<PurgeSummary> {
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, teamId: true, stripeCustomerId: true },
  });
  if (!person) return { users: 0, projects: 0, tasks: 0, projectsReassigned: 0 };

  const result = await prisma.$transaction(async tx => {
    const r = await deletePeople(tx, [person]);
    // A company left with nobody in it is removed too (with any projects still in it)
    if (person.teamId && (await tx.user.count({ where: { teamId: person.teamId } })) === 0) {
      const left = (await tx.project.findMany({ where: { teamId: person.teamId }, select: { id: true } })).map(p => p.id);
      r.tasks += await deleteProjects(tx, left);
      r.projects += left.length;
      await tx.teamInvitation.deleteMany({ where: { teamId: person.teamId } });
      await tx.team.delete({ where: { id: person.teamId } });
    }
    return r;
  }, TX_OPTIONS);

  await cancelBilling([person.stripeCustomerId]);
  await clearCaches([userId]);
  return { users: result.users, projects: result.projects, tasks: result.tasks, projectsReassigned: result.reassigned };
}
