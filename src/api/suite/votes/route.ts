/**
 * src/api/suite/votes/route.ts — GET /api/suite/votes
 * Feature-request votes of the open company (who asked, and the revenue behind each request).
 */
import prisma from '@/lib/prisma';
import { requireSuite, ok } from '@/lib/suite/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireSuite('customers');
  if (!access.ok) return access.response;
  const ctx = access.value;
  const votes = await prisma.featureVote.findMany({
    where: { request: { teamId: ctx.teamId } },
    select: { id: true, requestId: true, accountId: true, userId: true, note: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  return ok(votes);
}
