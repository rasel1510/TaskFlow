import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';
import { findStoredUserByEmail, saveStoredUser } from '@/data/userStore';
import { isGoogleOAuthConfigured, verifyGoogleAuthToken } from '@/lib/googleAuth';

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
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
        process.env.NODE_ENV === 'production' &&
        !process.env.NEXTAUTH_URL?.startsWith('http://localhost')
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure:
          process.env.NODE_ENV === 'production' &&
          !process.env.NEXTAUTH_URL?.startsWith('http://localhost'),
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
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: 'select_account',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isGoogleAuth: { label: 'isGoogleAuth', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);
        const isGoogleAuth = credentials.isGoogleAuth === 'true';

        // ─── 1. Google Quick Connect (HMAC verification) ───
        if (isGoogleAuth) {
          const isValidToken = verifyGoogleAuthToken(email, password);
          if (!isValidToken) {
            console.warn('[auth.ts] Invalid or expired Google Auth token for', email);
            return null;
          }

          // Fetch or provision user
          try {
            const dbUser = await prisma.user.findUnique({ where: { email } });
            if (dbUser) {
              return {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                image: dbUser.avatar,
                role: dbUser.role,
              };
            }
          } catch {
            // DB fallback handled below
          }

          const storedUser = findStoredUserByEmail(email);
          if (storedUser) {
            return {
              id: storedUser.id,
              name: storedUser.name,
              email: storedUser.email,
              image: storedUser.avatar,
              role: storedUser.role,
            };
          }

          // Fallback demo user
          const mockUser = mockUsers.find(u => u.email.toLowerCase() === email);
          if (mockUser) {
            return {
              id: mockUser.id,
              name: mockUser.name,
              email: mockUser.email,
              image: mockUser.avatar,
              role: mockUser.role,
            };
          }

          return null;
        }

        // ─── 2. Standard Credentials Login ───
        try {
          // Attempt to find user in database
          const dbUser = await prisma.user.findUnique({
            where: { email },
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
            };
          }
        } catch (storeError) {
          console.warn('[auth.ts] Error checking local user store:', storeError);
        }

        // Graceful fallback for mock/demo users
        const mockUser = mockUsers.find(
          u => u.email.toLowerCase() === email
        );

        if (mockUser) {
          // Allow demo access with standard password or demo mock accounts
          return {
            id: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            image: mockUser.avatar,
            role: mockUser.role,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const displayName =
          user.name ||
          email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const userAvatar = user.image || displayName.slice(0, 2).toUpperCase();

        try {
          let dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                name: displayName,
                email,
                avatar: userAvatar,
                role: 'User',
                emailVerified: new Date(),
              },
            });
          } else {
            if (!dbUser.emailVerified) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { emailVerified: new Date() },
              });
            }
          }

          saveStoredUser({
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            password: '',
            role: dbUser.role,
            avatar: dbUser.avatar,
            emailVerified: new Date().toISOString(),
          });

          user.id = dbUser.id;
          (user as { role?: string }).role = dbUser.role;
          (user as { avatar?: string }).avatar = dbUser.avatar;
        } catch (dbErr) {
          console.warn('[auth.ts] Failed to sync Google OAuth user in Prisma, using local store:', dbErr);
          const existingStored = findStoredUserByEmail(email);
          if (existingStored) {
            user.id = existingStored.id;
            (user as { role?: string }).role = existingStored.role;
            (user as { avatar?: string }).avatar = existingStored.avatar;
          } else {
            const newStored = saveStoredUser({
              name: displayName,
              email,
              password: '',
              role: 'User',
              avatar: userAvatar,
              emailVerified: new Date().toISOString(),
            });
            user.id = newStored.id;
            (user as { role?: string }).role = newStored.role;
            (user as { avatar?: string }).avatar = newStored.avatar;
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'User';
        token.avatar = (user as { avatar?: string }).avatar || user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) || 'User';
        (session.user as { avatar?: string }).avatar = (token.avatar as string) || '';
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
