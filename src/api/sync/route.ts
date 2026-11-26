/**
 * src/api/sync/route.ts — GET /api/sync
 *
 * Live-update check. Returns a small fingerprint ("rows:newest-change") for each area of the open
 * workspace. The browser compares fingerprints between checks and refreshes only the screens whose
 * data changed — so new comments, tasks, notifications and team changes appear without the
 * Refresh button. Counting rows as well as the newest timestamp also catches deletions.
 *
 * One database round trip; nothing is cached (the answer must be current).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';

export const dynamic = 'force-dynamic';

type Row = {
  tasks: string;
  projects: string;
  comments: string;
  notifications: string;
  team: string;
  messages: string;
  suite: string;
};

export async function GET() {
  const access = await requireUser();
  if (!access.ok) return access.response;
  const userId = access.value.id;

  // The open workspace (read fresh — the session can lag right after switching)
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { teamId: true } });
  const teamId = me?.teamId ?? '';

  try {
    const rows = await prisma.$queryRaw<Row[]>`
      WITH ws_projects AS (
        SELECT id FROM "Project" WHERE "teamId" = ${teamId}
      ),
      ws_tasks AS (
        SELECT t.id, t."updatedAt" FROM "Task" t
        WHERE t."projectId" IN (SELECT id FROM ws_projects)
           OR (t."projectId" IS NULL AND (t."assigneeId" = ${userId} OR t."creatorId" = ${userId}))
      )
      SELECT
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max("updatedAt")) * 1000)::text, '0')
           FROM ws_tasks) AS tasks,
        (SELECT (SELECT count(*) FROM "Project" WHERE "teamId" = ${teamId})
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max("updatedAt") FROM "Project" WHERE "teamId" = ${teamId})) * 1000)::text, '0')
           || ':' || (SELECT count(*) FROM "ProjectMember" WHERE "projectId" IN (SELECT id FROM ws_projects))
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max("joinedAt") FROM "ProjectMember" WHERE "projectId" IN (SELECT id FROM ws_projects))) * 1000)::text, '0')
        ) AS projects,
        (SELECT (SELECT count(*) FROM "Comment" WHERE "taskId" IN (SELECT id FROM ws_tasks))
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max(coalesce("updatedAt", "createdAt")) FROM "Comment" WHERE "taskId" IN (SELECT id FROM ws_tasks))) * 1000)::text, '0')
           || ':' || (SELECT count(*) FROM "Activity" WHERE "taskId" IN (SELECT id FROM ws_tasks))
        ) AS comments,
        (SELECT count(*) || ':' || count(*) FILTER (WHERE NOT "read") || ':'
                || coalesce(floor(extract(epoch FROM max("createdAt")) * 1000)::text, '0')
           FROM "Notification" WHERE "userId" = ${userId}) AS notifications,
        (SELECT (SELECT count(*) FROM "TeamMembership" WHERE "teamId" = ${teamId})
           || ':' || coalesce(floor(extract(epoch FROM (
                SELECT max(u."updatedAt") FROM "User" u
                JOIN "TeamMembership" m ON m."userId" = u.id AND m."teamId" = ${teamId})) * 1000)::text, '0')
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max("updatedAt") FROM "TeamInvitation" WHERE "teamId" = ${teamId})) * 1000)::text, '0')
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max("updatedAt") FROM "ProjectInvitation" WHERE "projectId" IN (SELECT id FROM ws_projects))) * 1000)::text, '0')
           || ':' || coalesce(floor(extract(epoch FROM (SELECT max("updatedAt") FROM "ProjectJoinRequest" WHERE "projectId" IN (SELECT id FROM ws_projects))) * 1000)::text, '0')
        ) AS team,
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max("updatedAt")) * 1000)::text, '0')
           FROM "ProjectMessage" WHERE "projectId" IN (SELECT id FROM ws_projects)) AS messages,
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max("createdAt")) * 1000)::text, '0')
           FROM "AuditLog" WHERE "teamId" = ${teamId}) AS suite
    `;
    const row = rows[0];
    return NextResponse.json(
      {
        success: true,
        data: {
          workspace: teamId || null,
          v: {
            tasks: row?.tasks ?? '',
            projects: row?.projects ?? '',
            comments: row?.comments ?? '',
            notifications: row?.notifications ?? '',
            team: row?.team ?? '',
            messages: row?.messages ?? '',
            suite: row?.suite ?? '',
          },
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    console.error('[GET /api/sync]', err);
    return NextResponse.json(
      { success: false, error: { code: 'SYNC_FAILED', message: 'Live updates are temporarily unavailable.' } },
      { status: 503 }
    );
  }
}
