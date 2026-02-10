import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows, showItems, claims } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { updateShowSchema } from '@/lib/validations/shows';

async function handleGet(
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

  const items = await db
    .select()
    .from(showItems)
    .where(eq(showItems.showId, showId))
    .orderBy(showItems.itemNumber);

  const claimStats = await db
    .select({
      totalClaims: sql<number>`count(*)`,
      winners: sql<number>`sum(case when ${claims.claimStatus} = 'winner' then 1 else 0 end)`,
      waitlisted: sql<number>`sum(case when ${claims.claimStatus} = 'waitlist' then 1 else 0 end)`,
      uniqueBuyers: sql<number>`count(distinct case when ${claims.claimStatus} = 'winner' then ${claims.platformUserId} end)`,
    })
    .from(claims)
    .where(eq(claims.showId, showId));

  return NextResponse.json({
    data: {
      ...show,
      items,
      stats: {
        totalClaims: Number(claimStats[0]?.totalClaims ?? 0),
        winners: Number(claimStats[0]?.winners ?? 0),
        waitlisted: Number(claimStats[0]?.waitlisted ?? 0),
        uniqueBuyers: Number(claimStats[0]?.uniqueBuyers ?? 0),
      },
    },
  });
}

async function handlePatch(
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

  const body = await req.json();
  const parsed = updateShowSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(shows)
    .where(and(eq(shows.id, showId), eq(shows.workspaceId, workspaceId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Show not found' } },
      { status: 404 },
    );
  }

  const [updated] = await db
    .update(shows)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(shows.id, showId))
    .returning();

  return NextResponse.json({ data: updated });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
