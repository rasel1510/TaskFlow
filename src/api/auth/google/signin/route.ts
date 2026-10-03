import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findStoredUserByEmail, saveStoredUser } from '@/data/userStore';
import { createGoogleAuthToken } from '@/lib/googleAuth';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function POST(req: Request) {
  try {
    let body: { email?: string; name?: string; avatar?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid JSON request payload' } },
        { status: 400 }
      );
    }

    const { email, name, avatar } = body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: { message: 'Please provide a valid Google account email' } },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const displayName =
      name && typeof name === 'string' && name.trim() !== ''
        ? name.trim()
        : normalizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const userAvatar = avatar && typeof avatar === 'string' ? avatar : getInitials(displayName);

    let userId: string | undefined;
    let userRole = 'User';

    // 1. Prisma database sync/provisioning
    try {
      let dbUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (dbUser) {
        userId = dbUser.id;
        userRole = dbUser.role || 'User';

        // Ensure emailVerified is marked for Google account
        if (!dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: new Date() },
          });
        }
      } else {
        // Provision new user seamlessly from Google
        const newUser = await prisma.user.create({
          data: {
            name: displayName,
            email: normalizedEmail,
            avatar: userAvatar,
            role: 'User',
            emailVerified: new Date(),
          },
        });
        userId = newUser.id;
        userRole = newUser.role;
      }

      // Sync with resilient local user store
      saveStoredUser({
        id: userId,
        name: displayName,
        email: normalizedEmail,
        password: '',
        role: userRole,
        avatar: userAvatar,
        emailVerified: new Date().toISOString(),
      });
    } catch (dbError) {
      console.warn('[Google SignIn API] Database write failed, using local store fallback:', dbError);

      const existingStored = findStoredUserByEmail(normalizedEmail);
      if (existingStored) {
        userId = existingStored.id;
        userRole = existingStored.role;
      } else {
        const newStored = saveStoredUser({
          name: displayName,
          email: normalizedEmail,
          password: '',
          role: 'User',
          avatar: userAvatar,
          emailVerified: new Date().toISOString(),
        });
        userId = newStored.id;
        userRole = newStored.role;
      }
    }

    // 2. Generate secure HMAC token for NextAuth Credentials callback
    const authToken = createGoogleAuthToken(normalizedEmail);

    return NextResponse.json({
      success: true,
      data: {
        email: normalizedEmail,
        token: authToken,
        name: displayName,
        userId,
      },
    });
  } catch (error) {
    console.error('[Google SignIn API] Error processing sign in:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error processing Google sign in' } },
      { status: 500 }
    );
  }
}
