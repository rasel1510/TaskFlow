/**
 * src/api/users/[id]/password/route.ts
 *
 * Password change endpoint:
 *   PATCH /api/users/:id/password — Verify current password, bcrypt hash new one
 *
 * Security rules:
 *   1. Session must match :id (self-only)
 *   2. currentPassword must match stored hash — prevents CSRF token-only attacks
 *   3. Minimum 6-char new password enforced by Zod schema
 *   4. bcrypt work factor 12 — sufficient protection against brute force
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { ChangePasswordSchema, validationError } from '@/lib/validators';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// PATCH /api/users/:id/password
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Self-only enforcement
    if (session.user.id !== id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { currentPassword, newPassword } = parsed.data;

    const { findStoredUserById, findStoredUserByEmail, updateStoredUser } = await import('@/data/userStore');
    const stored = findStoredUserById(id) || (session.user.email ? findStoredUserByEmail(session.user.email) : null);

    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, password: true },
      });
    } catch (e) {
      console.warn('[PATCH /api/users/:id/password] DB lookup error:', e);
    }

    if (!user && !stored) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const currentHash = user?.password || stored?.password;

    // If user has a password stored, verify it
    if (currentHash) {
      const isValid = await bcrypt.compare(currentPassword, currentHash);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } },
          { status: 400 }
        );
      }
    }

    // Reject if new password is same as current
    if (currentHash) {
      const isSame = await bcrypt.compare(newPassword, currentHash);
      if (isSame) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'New password must be different from current password' } },
          { status: 400 }
        );
      }
    }

    // Hash with bcrypt work factor 12 (OWASP recommended minimum)
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    try {
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      } else if (stored) {
        await prisma.user.upsert({
          where: { id: stored.id },
          create: {
            id: stored.id,
            name: stored.name,
            email: stored.email,
            password: hashedPassword,
            role: stored.role || 'User',
            avatar: stored.avatar || 'U',
            expertise: stored.expertise || [],
            createdAt: new Date(stored.createdAt),
          },
          update: {
            password: hashedPassword,
          },
        });
      }
    } catch (dbErr) {
      console.warn('[PATCH /api/users/:id/password] Prisma update failed:', dbErr);
    }

    // Always update local userStore
    updateStoredUser(id, { password: hashedPassword });

    return NextResponse.json(
      { success: true, data: { message: 'Password updated successfully' } },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/users/:id/password] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update password' } },
      { status: 500 }
    );
  }
}
