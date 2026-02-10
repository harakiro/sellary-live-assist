import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(req: AuthenticatedRequest) {
  const { workspaceId } = req.auth;

  const connections = await db
    .select({
      id: socialConnections.id,
      platform: socialConnections.platform,
      externalAccountId: socialConnections.externalAccountId,
      displayName: socialConnections.displayName,
      status: socialConnections.status,
      tokenExpiresAt: socialConnections.tokenExpiresAt,
      scopes: socialConnections.scopes,
      createdAt: socialConnections.createdAt,
    })
    .from(socialConnections)
    .where(eq(socialConnections.workspaceId, workspaceId))
    .orderBy(socialConnections.createdAt);

  return NextResponse.json({ data: connections });
}

export const GET = withAuth(handler);
