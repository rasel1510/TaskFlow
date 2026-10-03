import { handlers } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.pathname.includes('/callback/google')) {
    const error = url.searchParams.get('error');
    if (error === 'access_denied') {
      return NextResponse.redirect(new URL('/auth/login?error=AccessDenied', req.url));
    }
  }
  return handlers.GET(req);
}

export const POST = handlers.POST;
