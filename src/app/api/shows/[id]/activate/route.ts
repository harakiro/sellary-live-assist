import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows, socialConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { broadcastToShow } from '@/lib/realtime/server';
import { startPolling } from '@/lib/platforms/facebook/polling';
import { logAuditEvent } from '@/lib/audit';

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

  // Start FB polling if connection + liveId are set
  if (show.platform === 'facebook' && show.connectionId && show.liveId) {
    const [connection] = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.id, show.connectionId))
      .limit(1);

    if (connection) {
      startPolling(showId, show.liveId, connection.encryptedAccessToken);
    }
  }

  broadcastToShow(showId, {
    type: 'session.status',
    data: { showId, status: 'active', timestamp: new Date().toISOString() },
  });

  logAuditEvent(db, {
    workspaceId,
    showId,
    actorUserId: req.auth.userId,
    action: 'show.activated',
    entityType: 'show',
    entityId: showId,
    details: { previousStatus: show.status },
  }).catch(() => {});

  return NextResponse.json({ data: updated });
}

export const POST = withAuth(handler);
