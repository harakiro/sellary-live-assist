import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { decrypt } from '@/lib/encryption';
import { getActiveLives as getFBLives } from '@/lib/platforms/facebook/api';
import { getActiveLives as getIGLives } from '@/lib/platforms/instagram/api';

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const { workspaceId } = req.auth;
  const connectionId = context?.params?.id;

  if (!connectionId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Connection ID required' } },
      { status: 400 },
    );
  }

  const [connection] = await db
    .select()
    .from(socialConnections)
    .where(
      and(eq(socialConnections.id, connectionId), eq(socialConnections.workspaceId, workspaceId)),
    )
    .limit(1);

  if (!connection) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Connection not found' } },
      { status: 404 },
    );
  }

  try {
    const accessToken = decrypt(connection.encryptedAccessToken);

    if (connection.platform === 'facebook') {
      const lives = await getFBLives(accessToken, connection.externalAccountId);
      return NextResponse.json({ data: lives });
    }

    if (connection.platform === 'instagram') {
      const lives = await getIGLives(accessToken, connection.externalAccountId);
      return NextResponse.json({ data: lives });
    }

    return NextResponse.json({ data: [] });
  } catch (err) {
    console.error('Live discovery error:', err);
    return NextResponse.json(
      { error: { code: 'PLATFORM_ERROR', message: 'Failed to fetch live broadcasts' } },
      { status: 502 },
    );
  }
}

export const GET = withAuth(handler);
