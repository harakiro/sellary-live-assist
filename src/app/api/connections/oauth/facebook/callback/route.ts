import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { encrypt } from '@/lib/encryption';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getConnectedPages,
} from '@/lib/platforms/facebook/oauth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${appUrl}/sales-channels?error=${encodeURIComponent(error || 'no_code')}`,
    );
  }

  // Extract workspace context from the state parameter set during OAuth start
  const stateParam = searchParams.get('state') || '';
  let workspaceId: string | null = null;

  try {
    const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    workspaceId = stateData.workspaceId || null;
  } catch {
    // Invalid state
  }

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
      return NextResponse.redirect(`${appUrl}/sales-channels?error=no_workspace`);
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
          scopes: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_metadata', 'pages_manage_engagement', 'pages_messaging'],
          status: 'active',
        })
        .onConflictDoUpdate({
          target: [socialConnections.workspaceId, socialConnections.platform, socialConnections.externalAccountId],
          set: {
            displayName: page.name,
            encryptedAccessToken: encryptedToken,
            tokenExpiresAt: new Date(Date.now() + longToken.expiresIn * 1000),
            scopes: ['pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_metadata', 'pages_manage_engagement', 'pages_messaging'],
            status: 'active',
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.redirect(`${appUrl}/sales-channels?success=facebook&count=${pages.length}`);
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/sales-channels?error=oauth_failed`);
  }
}
