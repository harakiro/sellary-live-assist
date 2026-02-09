import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { claims } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const showId = context?.params?.id;
  if (!showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const result = await db
    .select({
      platformUserId: claims.platformUserId,
      userHandle: claims.userHandle,
      userDisplayName: claims.userDisplayName,
      itemCount: sql<number>`count(*)`,
      itemNumbers: sql<string>`string_agg(${claims.itemNumber}, ',' ORDER BY ${claims.itemNumber})`,
    })
    .from(claims)
    .where(and(eq(claims.showId, showId), eq(claims.claimStatus, 'winner')))
    .groupBy(claims.platformUserId, claims.userHandle, claims.userDisplayName);

  return NextResponse.json({ data: result });
}

export const GET = withAuth(handler);
