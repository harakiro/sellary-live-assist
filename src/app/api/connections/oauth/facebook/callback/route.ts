import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { encrypt } from '@/lib/encryption';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getConnectedPages,
} from '@/lib/platforms/facebook/oauth';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${appUrl}/connections?error=${encodeURIComponent(error || 'no_code')}`,
    );
  }

  // Extract workspace from a cookie/state token
  // For now, use the token from a cookie header
  const cookieToken = req.cookies.get('auth_token')?.value;
  let workspaceId: string | null = null;

  if (cookieToken) {
    try {
      const payload = await verifyAccessToken(cookieToken);
      workspaceId = payload.workspaceId;
    } catch {
      // Token invalid
    }
  }

  // Also check Authorization header forwarded via state (simplified)
  const state = searchParams.get('state') || '';
  // In production, validate state against stored value

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${appUrl}/api/connections/oauth/facebook/callback`;

    // Exchange code for short-lived token
    const shortToken = await exchangeCodeForToken(code, redirectUri);

    // Extend to long-lived token
    const longToken = await exchangeForLongLivedToken(shortToken.accessToken);

    // Get pages
    const pages = await getConnectedPages(longToken.accessToken);

    if (!workspaceId) {
      return NextResponse.redirect(`${appUrl}/connections?error=no_workspace`);
    }

    // Create a connection for each page
    for (const page of pages) {
      const encryptedToken = encrypt(page.accessToken);

      await db
        .insert(socialConnections)
        .values({
          workspaceId,
          platform: 'facebook',
          externalAccountId: page.id,
          displayName: page.name,
          encryptedAccessToken: encryptedToken,
          tokenExpiresAt: new Date(Date.now() + longToken.expiresIn * 1000),
          scopes: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content'],
          status: 'active',
        })
        .onConflictDoNothing();
    }

    return NextResponse.redirect(`${appUrl}/connections?success=facebook&count=${pages.length}`);
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/connections?error=oauth_failed`);
  }
}
