/**
 * src/lib/projectInvites.ts
 *
 * Shared helpers for project email invitations (accept / decline).
 */

import prisma from '@/lib/prisma';
import redisCache from '@/lib/redis';
import { wantsNotification } from '@/lib/notificationPrefs';

export const projectInviteSelect = {
  id: true,
  projectId: true,
  email: true,
  role: true,
  token: true,
  status: true,
  expiresAt: true,
  invitedById: true,
  project: { select: { id: true, name: true, color: true, teamId: true, team: { select: { name: true } } } },
  invitedBy: { select: { id: true, name: true, email: true } },
} as const;

export type LoadedProjectInvite = NonNullable<Awaited<ReturnType<typeof loadProjectInvite>>>;

export async function loadProjectInvite(token: string) {
  if (!token || token.length < 10) return null;
  return prisma.projectInvitation.findUnique({ where: { token }, select: projectInviteSelect });
}

/** pending | accepted | declined | revoked | expired (expiry computed from the date too) */
export function effectiveInviteStatus(inv: { status: string; expiresAt: Date }): string {
  if (inv.status === 'pending' && inv.expiresAt.getTime() < Date.now()) return 'expired';
  return inv.status;
}

export function inviteStatusMessage(status: string, projectName: string): string {
  switch (status) {
    case 'accepted':
      return `This invitation to ${projectName} has already been accepted.`;
    case 'declined':
      return `This invitation to ${projectName} was declined.`;
    case 'revoked':
      return `This invitation to ${projectName} is no longer valid. A newer invitation may have been sent — check your inbox, or ask the project owner to invite you again.`;
    case 'expired':
      return `This invitation to ${projectName} has expired. Ask the project owner to send a new one.`;
    default:
      return 'This invitation is not valid.';
  }
}

/** In-app notification to the person who sent the invitation. Never throws. */
export async function notifyInviter(inv: LoadedProjectInvite, kind: 'accepted' | 'declined', actorName: string) {
  try {
    if (!(await wantsNotification(inv.invitedById, 'project_activity'))) return;
    await prisma.notification.create({
      data: {
        userId: inv.invitedById,
        type: kind === 'accepted' ? 'invite_accepted' : 'invite_declined',
        title: kind === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
        body:
          kind === 'accepted'
            ? `${actorName} accepted your invitation and joined ${inv.project.name}.`
            : `${actorName} declined your invitation to ${inv.project.name}.`,
      },
    });
    await redisCache.delPattern('notifs:*');
  } catch (err) {
    console.warn('[projectInvites] Could not notify inviter:', err);
  }
}

/** Password rules for accounts created from an invitation */
export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include at least one letter and one number.';
  return null;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || 'U').slice(0, 2);
  return letters.toUpperCase();
}
