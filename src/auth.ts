import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { findStoredUserByEmail } from '@/data/userStore';

// Prevent localhost NEXTAUTH_URL from corrupting Vercel serverless requests
if (process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.includes('localhost')) {
  delete process.env.NEXTAUTH_URL;
}
if (process.env.VERCEL_URL && !process.env.AUTH_URL) {
  process.env.AUTH_TRUST_HOST = 'true';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'flowsync-secure-nextauth-secret-key-32chars',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days persistent session
    updateAge: 24 * 60 * 60, // 24 hours rolling renewal
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days persistent cookie
      },
    },
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/',
    newUser: '/auth/signup',
    error: '/auth/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        // ─── 2. Standard Credentials Login ───
        try {
          // Attempt to find user in database with team information
          const dbUser = await prisma.user.findUnique({
            where: { email },
            include: { team: { select: { id: true, name: true, slug: true } } },
          });

          if (dbUser) {
            if (dbUser.password) {
              const isValid = await bcrypt.compare(password, dbUser.password);
              if (!isValid) {
                return null;
              }
            }
            return {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              image: dbUser.avatar,
              role: dbUser.role,
              teamId: dbUser.teamId,
              teamName: dbUser.team?.name,
            };
          }
        } catch {
          // Prisma database connection fallback
        }

        // Check persistent local user store (registered users)
        try {
          const storedUser = findStoredUserByEmail(email);
          if (storedUser) {
            if (storedUser.password) {
              const isValid = await bcrypt.compare(password, storedUser.password);
              if (!isValid) {
                return null;
              }
            }
            return {
              id: storedUser.id,
              name: storedUser.name,
              email: storedUser.email,
              image: storedUser.avatar,
              role: storedUser.role,
              teamId: storedUser.teamId,
              teamName: storedUser.teamName,
            };
          }
        } catch (storeError) {
          console.warn('[auth.ts] Error checking local user store:', storeError);
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = (user as { role?: string }).role || 'User';
        token.avatar = (user as { avatar?: string }).avatar || user.image;
        token.teamId = (user as { teamId?: string }).teamId;
        token.teamName = (user as { teamName?: string }).teamName;
      }

      if (trigger === 'update' && session) {
        if (session.name) token.name = session.name;
        if (session.avatar) token.avatar = session.avatar;
        if (session.role) token.role = session.role;
        if (session.teamName) token.teamName = session.teamName;
      }

      // Sync latest user details from DB so token stays fresh across reloads
      if (token.id && !user && trigger !== 'update') {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, role: true, avatar: true, teamId: true, team: { select: { name: true } } },
          });
          if (freshUser) {
            if (freshUser.name) token.name = freshUser.name;
            if (freshUser.role) token.role = freshUser.role;
            if (freshUser.avatar) token.avatar = freshUser.avatar;
            if (freshUser.teamId) token.teamId = freshUser.teamId;
            if (freshUser.team?.name) token.teamName = freshUser.team.name;
          }
        } catch {
          // Fallback if DB query fails
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.name) session.user.name = token.name as string;
        (session.user as { role?: string }).role = (token.role as string) || 'User';
        (session.user as { avatar?: string }).avatar = (token.avatar as string) || '';
        (session.user as { teamId?: string }).teamId = (token.teamId as string) || '';
        (session.user as { teamName?: string }).teamName = (token.teamName as string) || '';
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/app`;
    },
  },
});
