import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
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
  const limit = Math.min(Number(searchParams.get('limit') || 200), 500);
  const offset = Number(searchParams.get('offset') || 0);

  const result = await db
    .select()
    .from(comments)
    .where(eq(comments.showId, showId))
    .orderBy(desc(comments.receivedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ data: result });
}

export const GET = withAuth(handler);
