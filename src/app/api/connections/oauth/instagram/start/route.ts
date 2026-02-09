import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { buildIGAuthUrl } from '@/lib/platforms/instagram/oauth';

async function handler(req: AuthenticatedRequest) {
  const state = randomBytes(16).toString('hex');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/connections/oauth/instagram/callback`;

  const authUrl = buildIGAuthUrl(redirectUri, state);

  return NextResponse.json({
    data: {
      authUrl,
      state,
    },
  });
}

export const GET = withAuth(handler);
