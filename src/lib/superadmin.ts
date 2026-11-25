/**
 * src/lib/superadmin.ts
 *
 * Server-side Super Admin authorization and security guards.
 * Ensures only authorized FlowSync platform operators can access superadmin APIs.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/permissions';

export interface SuperAdminAuthResult {
  authorized: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    teamId: string | null;
    teamName?: string;
  };
  errorResponse?: NextResponse;
}

export async function verifySuperAdmin(): Promise<SuperAdminAuthResult> {
  const session = await auth();

  if (!session?.user?.id && !session?.user?.email) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      ),
    };
  }

  const email = session.user.email?.toLowerCase().trim();
  const sessionUser = session.user as any;

  // SECURITY: decided from the database only — session contents are never trusted for this
  // Authoritative check against database
  if (email || sessionUser.id) {
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(sessionUser.id ? [{ id: sessionUser.id }] : []),
          ],
        },
        include: {
          team: { select: { id: true, name: true, slug: true } },
        },
      });

      if (dbUser && isSuperAdmin({ email: dbUser.email, role: dbUser.role, teamName: dbUser.team?.name })) {
        return {
          authorized: true,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            teamId: dbUser.teamId,
            teamName: dbUser.team?.name,
          },
        };
      }
    } catch (err) {
      console.error('[verifySuperAdmin] DB check error:', err);
    }
  }

  return {
    authorized: false,
    errorResponse: NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Super Admin access required. Only FlowSync platform owners may access this resource.',
        },
      },
      { status: 403 }
    ),
  };
}

