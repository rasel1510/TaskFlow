import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import redisCache from '@/lib/redis';
import { getOrProvisionUserTeam } from '@/lib/tenant';
import { inTeam } from '@/lib/workspaces';

/**
 * GET /api/users
 *
 * Strictly Multi-Tenant Company User Directory.
 * Guarantees that Workspace Administrators and Project Managers only EVER see
 * members who belong to their own company/team.
 *
 * Security & Isolation Rules:
 * 1. Strict Authentication: Unauthenticated callers receive 401 and empty payload.
 * 2. Strict Team Boundary: Users from Company A are completely blocked from Company B.
 * 3. Project Scoping: If ?projectId=... is provided, verifies project belongs to the user's team.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionUserId = session?.user?.id;
    const sessionUserEmail = session?.user?.email;

    if (!sessionUserId && !sessionUserEmail) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Resolve user record to guarantee valid database identity
    let resolvedUserId = sessionUserId;
    if (!resolvedUserId && sessionUserEmail) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: sessionUserEmail.toLowerCase().trim() },
        select: { id: true },
      });
      resolvedUserId = userByEmail?.id;
    }

    if (!resolvedUserId) {
      return NextResponse.json([], { status: 401 });
    }

    // Resolve caller's organization / team context
    const teamContext = await getOrProvisionUserTeam(resolvedUserId);
    if (!teamContext?.teamId) {
      return NextResponse.json([], { status: 200 });
    }

    const companyTeamId = teamContext.teamId;

    // If an explicit projectId is passed, verify project belongs to caller's company
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { teamId: true },
      });

      if (project?.teamId && project.teamId !== companyTeamId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: Project belongs to another organization' } },
          { status: 403 }
        );
      }
    }

    // Cache strictly keyed by teamId to prevent cross-tenant data leaks
    const cacheKey = `users:team:${companyTeamId}`;

    const companyMembers = await redisCache.wrap(cacheKey, 60, async () => {
      // 1. Fetch strictly from DB users belonging to this company's teamId
      let dbUsers: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        avatar: string;
        expertise?: string[];
      }> = [];

      try {
        dbUsers = await prisma.user.findMany({
          where: inTeam(companyTeamId),
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            expertise: true,
          },
          orderBy: { name: 'asc' },
        });
      } catch (dbErr) {
        console.warn('[GET /api/users] DB user fetch error:', dbErr);
      }

      const userMap = new Map<string, {
        id: string;
        name: string;
        email: string;
        role: string;
        avatar: string;
        expertise?: string[];
      }>();

      // Company members from the database
      for (const u of dbUsers) {
        userMap.set(u.id, {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar || u.name.slice(0, 2).toUpperCase(),
          expertise: u.expertise || [],
        });
      }

      return Array.from(userMap.values());
    });

    return NextResponse.json(companyMembers, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Vary': 'Cookie',
      },
    });
  } catch (error) {
    console.error('[GET /api/users] Error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
