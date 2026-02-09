import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { broadcastToShow } from '@/lib/realtime/server';

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

  if (!show) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Show not found' } },
      { status: 404 },
    );
  }

  if (show.status !== 'draft' && show.status !== 'paused') {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: `Cannot activate show in ${show.status} status` } },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(shows)
    .set({
      status: 'active',
      startedAt: show.startedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(shows.id, showId))
    .returning();

  broadcastToShow(showId, {
    type: 'session.status',
    data: { showId, status: 'active', timestamp: new Date().toISOString() },
  });

  return NextResponse.json({ data: updated });
}

export const POST = withAuth(handler);
