import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { sendLoginNotificationEmail, sendSignupNotificationEmail } from '@/lib/mail';
import { isSuperAdmin } from '@/lib/permissions';

// Prevent non-https or localhost NEXTAUTH_URL from corrupting production/Vercel serverless requests
if (process.env.NODE_ENV === 'production') {
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('https://')) {
    delete process.env.NEXTAUTH_URL;
  }
}
if (process.env.VERCEL_URL && !process.env.AUTH_URL) {
  process.env.AUTH_TRUST_HOST = 'true';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  basePath: '/api/auth',
  trustHost: true,
  // Never ship a known fallback secret in production — anyone could forge session JWTs with it.
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'flowsync-dev-only-nextauth-secret-key-32chars' : undefined),
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
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
            include: {
              team: { select: { id: true, name: true, slug: true } },
              invoices: { select: { id: true, status: true }, take: 5 },
            },
          });

          if (dbUser) {
            // Accounts without a password (e.g. Google-only sign-ups) must never be
            // reachable through the credentials provider — reject instead of skipping the check.
            if (!dbUser.password) {
              return null;
            }
            const isValid = await bcrypt.compare(password, dbUser.password);
            if (!isValid) {
              return null;
            }
            const hasPaid =
              dbUser.plan === 'pro' ||
              dbUser.plan === 'basic';

            return {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              image: dbUser.avatar,
              role: dbUser.role,
              teamId: dbUser.teamId,
              teamName: dbUser.team?.name,
              plan: dbUser.plan,
              hasPaid,
              hasCompletedOnboarding: Boolean((dbUser.hasCompletedOnboarding && dbUser.teamId) || dbUser.teamId),
            };
          }
        } catch (err) {
          console.error('[auth] Credentials sign-in failed (database unavailable):', err);
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        try {
          // 1. Check if user already exists in database
          let dbUser = await prisma.user.findUnique({
            where: { email },
            include: {
              team: { select: { id: true, name: true, slug: true } },
              invoices: { select: { id: true, status: true }, take: 5 },
            },
          });

          // 2. If new user signing in with Google, auto-provision user account
          const isNewGoogleUser = !dbUser;
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email,
                name: user.name || profile?.name || email.split('@')[0],
                avatar:
                  user.image ||
                  (profile as any)?.picture ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
                role: 'Admin',
                emailVerified: new Date(),
                plan: 'free',
                hasCompletedOnboarding: false,
              },
              include: {
                team: { select: { id: true, name: true, slug: true } },
                invoices: { select: { id: true, status: true }, take: 5 },
              },
            });

            // Dispatch welcome signup notification email
            sendSignupNotificationEmail({
              to: email,
              name: dbUser.name,
              signupMethod: 'Google OAuth 2.0',
            }).catch(err => console.error('[Google signup email notification error]:', err));
          } else {
            // Update emailVerified / avatar if needed
            if (!dbUser.emailVerified || (!dbUser.avatar && user.image)) {
              dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                  emailVerified: dbUser.emailVerified || new Date(),
                  avatar: dbUser.avatar || user.image || undefined,
                },
                include: {
                  team: { select: { id: true, name: true, slug: true } },
                  invoices: { select: { id: true, status: true }, take: 5 },
                },
              });
            }

            // Dispatch sign-in security notification email
            sendLoginNotificationEmail({
              to: email,
              name: dbUser.name || user.name || undefined,
              loginMethod: 'Google OAuth 2.0',
            }).catch(err => console.error('[Google login email notification error]:', err));
          }

          // Populate the user object so `jwt` callback attaches DB properties
          const hasPaid =
            dbUser.plan === 'pro' ||
            dbUser.plan === 'basic';

          user.id = dbUser.id;
          (user as any).role = dbUser.role || 'Member';
          (user as any).avatar = dbUser.avatar || user.image;
          (user as any).teamId = dbUser.teamId;
          (user as any).teamName = dbUser.team?.name;
          (user as any).plan = dbUser.plan || 'free';
          (user as any).hasPaid = hasPaid;
          (user as any).hasCompletedOnboarding = Boolean(
            (dbUser.hasCompletedOnboarding && dbUser.teamId) || dbUser.teamId
          );

          return true;
        } catch (oauthErr) {
          console.error('[Google OAuth signIn callback error]:', oauthErr);
          return false;
        }
      }

      // Credentials login notification
      if (account?.provider === 'credentials' && user?.email) {
        sendLoginNotificationEmail({
          to: user.email,
          name: user.name || undefined,
          loginMethod: 'Email & Password',
        }).catch(err => console.error('[Credentials login email notification error]:', err));
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        const rawUserRole = (user as { role?: string }).role;
        token.role = (!rawUserRole || rawUserRole === 'User') ? 'Member' : rawUserRole;
        token.avatar = (user as { avatar?: string }).avatar || user.image;
        token.teamId = (user as { teamId?: string }).teamId;
        token.teamName = (user as { teamName?: string }).teamName;
        token.plan = (user as any).plan || 'free';
        token.hasPaid = Boolean((user as any).hasPaid);
        token.hasCompletedOnboarding = Boolean((user as any).hasCompletedOnboarding);
        token.isSuperAdmin = isSuperAdmin({
          email: user.email,
          role: token.role as string,
          teamName: token.teamName as string,
        });
      }

      if (trigger === 'update' && session) {
        if (session.name) token.name = session.name;
        if (session.avatar) token.avatar = session.avatar;
        if (session.role) token.role = session.role;
        if (session.teamName) token.teamName = session.teamName;
        token.isSuperAdmin = isSuperAdmin({
          email: token.email as string,
          role: token.role as string,
          teamName: token.teamName as string,
        });
      }

      // Sync latest user details from DB so token stays fresh across reloads
      // Sync latest user details from DB periodically (at most once every 60s per session)
      const now = Date.now();
      const lastSynced = (token.lastSynced as number) || 0;
      if (token.id && !user && trigger !== 'update' && (now - lastSynced > 60000 || !token.teamId)) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              email: true,
              name: true,
              role: true,
              avatar: true,
              teamId: true,
              plan: true,
              hasCompletedOnboarding: true,
              invoices: { select: { id: true, status: true }, take: 5 },
              team: { select: { name: true } },
            },
          });
          if (freshUser) {
            if (freshUser.name) token.name = freshUser.name;
            if (freshUser.role) token.role = freshUser.role;
            if (freshUser.avatar) token.avatar = freshUser.avatar;
            if (freshUser.teamId) token.teamId = freshUser.teamId;
            if (freshUser.team?.name) token.teamName = freshUser.team.name;
            token.plan = freshUser.plan;
            token.hasPaid =
              freshUser.plan === 'pro' ||
              freshUser.plan === 'basic';
            token.hasCompletedOnboarding = Boolean(
              (freshUser.hasCompletedOnboarding && freshUser.teamId) || freshUser.teamId
            );
            token.isSuperAdmin = isSuperAdmin({
              email: freshUser.email,
              role: freshUser.role,
              teamName: freshUser.team?.name,
            });
            token.lastSynced = now;
          } else {
            // The account was deleted — end this session so the browser signs out cleanly
            return null;
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
        const rawTokenRole = token.role as string;
        (session.user as { role?: string }).role = (!rawTokenRole || rawTokenRole === 'User') ? 'Member' : rawTokenRole;
        (session.user as { avatar?: string }).avatar = (token.avatar as string) || '';
        (session.user as { teamId?: string }).teamId = (token.teamId as string) || '';
        (session.user as { teamName?: string }).teamName = (token.teamName as string) || '';
        (session.user as any).plan = token.plan || 'free';
        (session.user as any).hasPaid = Boolean(token.hasPaid);
        (session.user as any).hasCompletedOnboarding = Boolean(
          (token.hasCompletedOnboarding && token.teamId) || token.teamId
        );
        (session.user as any).isSuperAdmin = Boolean(token.isSuperAdmin) || isSuperAdmin({
          email: session.user.email,
          role: (session.user as any).role,
          teamName: (session.user as any).teamName,
        });
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
