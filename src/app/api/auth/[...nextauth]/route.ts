import { handlers } from '@/auth';
import { NextRequest } from 'next/server';

export const GET = handlers.GET;

export async function POST(req: NextRequest) {
  const res = await handlers.POST(req);
  if (req.nextUrl.pathname.includes('/signout')) {
    const cookieNames = [
      'authjs.session-token',
      '__Secure-authjs.session-token',
      'authjs.session-token.0',
      '__Secure-authjs.session-token.0',
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.session-token.0',
      '__Secure-next-auth.session-token.0',
    ];
    for (const name of cookieNames) {
      res.headers.append(
        'Set-Cookie',
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`
      );
    }
  }
  return res;
}
