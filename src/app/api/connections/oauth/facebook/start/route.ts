import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { buildFBAuthUrl } from '@/lib/platforms/facebook/oauth';

async function handler(req: AuthenticatedRequest) {
  const csrf = randomBytes(16).toString('hex');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/connections/oauth/facebook/callback`;

  // Encode workspace context into state so it survives the OAuth redirect round-trip
  const state = Buffer.from(
    JSON.stringify({ csrf, workspaceId: req.auth.workspaceId }),
  ).toString('base64url');

  const authUrl = buildFBAuthUrl(redirectUri, state);

  return NextResponse.json({
    data: {
      authUrl,
      state: csrf,
    },
  });
}

export const GET = withAuth(handler);
