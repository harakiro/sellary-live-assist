import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { manualAward } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';

const awardSchema = z.object({
  userHandle: z.string().min(1, 'User handle required'),
});

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const showId = context?.params?.id;
  const itemId = context?.params?.itemId;

  if (!showId || !itemId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID and Item ID required' } },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = awardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const result = await manualAward(db, showId, itemId, parsed.data.userHandle, req.auth.userId);

  if (result.status === 'item_not_found') {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Item not found' } },
      { status: 404 },
    );
  }

  if (result.status === 'no_quantity_available') {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'No quantity available' } },
      { status: 409 },
    );
  }

  broadcastToShow(showId, {
    type: 'claim.created',
    data: {
      claimId: result.claimId,
      showId,
      itemNumber: '',
      userHandle: parsed.data.userHandle,
      claimStatus: 'winner',
      timestamp: new Date().toISOString(),
    },
  });

  return NextResponse.json({ data: result }, { status: 201 });
}

export const POST = withAuth(handler);
