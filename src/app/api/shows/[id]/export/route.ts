import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows, claims, showItems } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const { workspaceId } = req.auth;
  const showId = context?.params?.id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'claims';

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

  const safeName = show.name.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date().toISOString().slice(0, 10);

  if (type === 'buyers') {
    const rows = await db
      .select({
        userHandle: claims.userHandle,
        userDisplayName: claims.userDisplayName,
        itemCount: sql<number>`count(*)`,
        itemNumbers: sql<string>`string_agg(${claims.itemNumber}, ',' ORDER BY ${claims.itemNumber})`,
      })
      .from(claims)
      .where(and(eq(claims.showId, showId), eq(claims.claimStatus, 'winner')))
      .groupBy(claims.platformUserId, claims.userHandle, claims.userDisplayName);

    let csv = 'user_handle,display_name,items_claimed,total_items\n';
    for (const row of rows) {
      csv += `"${escapeCsv(row.userHandle || '')}","${escapeCsv(row.userDisplayName || '')}","${escapeCsv(row.itemNumbers || '')}",${row.itemCount}\n`;
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${safeName}_buyers_${date}.csv"`,
      },
    });
  }

  // Default: claims export
  const rows = await db
    .select({
      createdAt: claims.createdAt,
      itemNumber: claims.itemNumber,
      userHandle: claims.userHandle,
      claimStatus: claims.claimStatus,
      waitlistPosition: claims.waitlistPosition,
    })
    .from(claims)
    .where(eq(claims.showId, showId))
    .orderBy(claims.createdAt);

  // Get item titles
  const items = await db.select().from(showItems).where(eq(showItems.showId, showId));
  const titleMap = new Map(items.map((i) => [i.itemNumber, i.title]));

  let csv = 'timestamp,item_number,item_title,user_handle,status,waitlist_position\n';
  for (const row of rows) {
    csv += `${row.createdAt?.toISOString() || ''},${row.itemNumber},"${escapeCsv(titleMap.get(row.itemNumber) || '')}","${escapeCsv(row.userHandle || '')}",${row.claimStatus},${row.waitlistPosition ?? ''}\n`;
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${safeName}_claims_${date}.csv"`,
    },
  });
}

function escapeCsv(s: string): string {
  return s.replace(/"/g, '""');
}

export const GET = withAuth(handler);
