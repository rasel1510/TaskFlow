import { NextResponse } from 'next/server';
import { isGoogleOAuthConfigured } from '@/lib/googleAuth';

export async function GET() {
  const configured = isGoogleOAuthConfigured();
  return NextResponse.json({
    success: true,
    data: {
      configured,
      provider: 'google',
    },
  });
}
