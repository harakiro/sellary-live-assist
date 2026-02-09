import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { encrypt } from '@/lib/encryption';
import { exchangeCodeForToken, getConnectedIGAccounts } from '@/lib/platforms/instagram/oauth';
import { exchangeForLongLivedToken } from '@/lib/platforms/facebook/oauth';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(
      `${appUrl}/connections?error=${encodeURIComponent(error || 'no_code')}`,
    );
  }

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

  try {
    const redirectUri = `${appUrl}/api/connections/oauth/instagram/callback`;

    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken.accessToken);
    const igAccounts = await getConnectedIGAccounts(longToken.accessToken);

    if (!workspaceId) {
      return NextResponse.redirect(`${appUrl}/connections?error=no_workspace`);
    }

    for (const account of igAccounts) {
      const encryptedToken = encrypt(longToken.accessToken);

      await db
        .insert(socialConnections)
        .values({
          workspaceId,
          platform: 'instagram',
          externalAccountId: account.id,
          displayName: `@${account.username}`,
          encryptedAccessToken: encryptedToken,
          tokenExpiresAt: new Date(Date.now() + longToken.expiresIn * 1000),
          scopes: ['instagram_basic', 'instagram_manage_comments'],
          status: 'active',
        })
        .onConflictDoNothing();
    }

    return NextResponse.redirect(
      `${appUrl}/connections?success=instagram&count=${igAccounts.length}`,
    );
  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/connections?error=oauth_failed`);
  }
}
