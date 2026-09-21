

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';
import { findStoredUserByEmail, saveStoredUser } from '@/data/userStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate initials avatar string from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const { name, email, password, role } = body ?? {};

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if ((password as string).length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const normalizedEmail = (email as string).toLowerCase().trim();
    const userRole = (role as string | undefined)?.trim() || 'User';
    const avatar = getInitials(name as string);
    const hashedPassword = await bcrypt.hash(password as string, 10);

    // First check fallback store / mock users for existing account
    const existingStored = findStoredUserByEmail(normalizedEmail);
    const existingMock = mockUsers.find(
      u => u.email.toLowerCase() === normalizedEmail
    );
    if (existingStored || existingMock) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    try {
      // Check for duplicate email in database
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { message: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      // Persist new user in database
      const newUser = await prisma.user.create({
        data: {
          name: (name as string).trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: userRole,
          avatar,
        },
      });

      // Also persist to local userStore for seamless failover
      saveStoredUser({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        password: hashedPassword,
        role: newUser.role,
        avatar: newUser.avatar,
      });

      return NextResponse.json(
        {
          message: 'Account created successfully',
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            avatar: newUser.avatar,
          },
        },
        { status: 201 }
      );
    } catch (dbError) {
      // Database unavailable / auth failure — persist safely to userStore
      console.warn('[POST /api/auth/signup] Prisma unavailable, saving to local store:', dbError);

      const storedUser = saveStoredUser({
        name: (name as string).trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole,
        avatar,
      });

      return NextResponse.json(
        {
          message: 'Account created successfully',
          user: {
            id: storedUser.id,
            name: storedUser.name,
            email: storedUser.email,
            role: storedUser.role,
            avatar: storedUser.avatar,
          },
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('[POST /api/auth/signup] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error while processing signup' },
      { status: 500 }
    );
  }
}
