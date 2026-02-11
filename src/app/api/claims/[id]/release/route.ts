import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { releaseClaim } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import { claims } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const claimId = context?.params?.id;
  if (!claimId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Claim ID required' } },
      { status: 400 },
    );
  }

  const result = await releaseClaim(db, claimId, req.auth.userId);

  if (result.status === 'claim_not_found') {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Claim not found' } },
      { status: 404 },
    );
  }

  if (result.status === 'already_released') {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Claim already released' } },
      { status: 409 },
    );
  }

  // Broadcast the release event
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
  if (claim) {
    broadcastToShow(claim.showId, {
      type: 'claim.released',
      data: {
        claimId,
        showId: claim.showId,
        itemNumber: claim.itemNumber,
        userHandle: claim.userHandle || '',
        promoted: result.promoted,
        timestamp: new Date().toISOString(),
      },
    });

    logAuditEvent(db, {
      workspaceId: req.auth.workspaceId,
      showId: claim.showId,
      actorUserId: req.auth.userId,
      action: 'claim.released',
      entityType: 'claim',
      entityId: claimId,
      details: { itemNumber: claim.itemNumber, userHandle: claim.userHandle },
    }).catch(() => {});
  }

  return NextResponse.json({ data: result });
}

export const POST = withAuth(handler);
