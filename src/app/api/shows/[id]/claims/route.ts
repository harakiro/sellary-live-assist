import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { claims } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const itemNumber = searchParams.get('item_number');

  let query = db.select().from(claims).where(eq(claims.showId, showId)).$dynamic();

  if (status) {
    query = query.where(and(eq(claims.showId, showId), eq(claims.claimStatus, status as 'winner' | 'waitlist' | 'released' | 'passed' | 'unmatched')));
  }

  if (itemNumber) {
    query = query.where(and(eq(claims.showId, showId), eq(claims.itemNumber, itemNumber)));
  }

  const result = await query.orderBy(desc(claims.createdAt));

  const mapped = result.map((c) => ({
    id: c.id,
    itemNumber: c.itemNumber,
    userHandle: c.userHandle ?? 'unknown',
    claimStatus: c.claimStatus,
    waitlistPosition: c.waitlistPosition,
    timestamp: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ data: mapped });
}

export const GET = withAuth(handler);
