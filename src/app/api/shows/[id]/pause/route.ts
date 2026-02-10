import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { broadcastToShow } from '@/lib/realtime/server';
import { stopPolling } from '@/lib/platforms/facebook/polling';

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const { workspaceId } = req.auth;
  const showId = context?.params?.id;

  if (!showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const [show] = await db
    .select()
    .from(shows)
    .where(and(eq(shows.id, showId), eq(shows.workspaceId, workspaceId)))
    .limit(1);

  if (!show || show.status !== 'active') {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Show must be active to pause' } },
      { status: 409 },
    );
  }

  stopPolling(showId);

  const [updated] = await db
    .update(shows)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(shows.id, showId))
    .returning();

  broadcastToShow(showId, {
    type: 'session.status',
    data: { showId, status: 'paused', timestamp: new Date().toISOString() },
  });

  return NextResponse.json({ data: updated });
}

export const POST = withAuth(handler);
