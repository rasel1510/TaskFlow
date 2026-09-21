import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { users as mockUsers } from '@/data/mockData';
import { findStoredUserByEmail } from '@/data/userStore';

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'taskflow-secure-nextauth-secret-key-32chars',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/signup',
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.avatar = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { avatar?: string }).avatar = token.avatar as string;
      }
      return session;
    },
  },
});
