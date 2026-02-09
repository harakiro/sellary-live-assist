import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { buildFBAuthUrl } from '@/lib/platforms/facebook/oauth';

async function handler(req: AuthenticatedRequest) {
  const state = randomBytes(16).toString('hex');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/connections/oauth/facebook/callback`;

  const authUrl = buildFBAuthUrl(redirectUri, state);

  // Return URL for the client to redirect to
  // State is embedded in the URL; in production, store it server-side for CSRF validation
  return NextResponse.json({
    data: {
      authUrl,
      state,
    },
  });
}

export const GET = withAuth(handler);
