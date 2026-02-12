import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices, claims, shows, integrations } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    invoiceAgg,
    itemsSoldResult,
    activeShowResult,
    staleCartsResult,
    errorCartsResult,
    stripeResult,
    recentShowsResult,
  ] = await Promise.all([
    // Invoice aggregates
    db
      .select({
        collectedCents: sql<number>`coalesce(sum(case when ${invoices.status} = 'paid' and ${invoices.paidAt} >= ${monthStart.toISOString()} then ${invoices.amountCents} else 0 end), 0)`,
        pendingCents: sql<number>`coalesce(sum(case when ${invoices.status} = 'sent' then ${invoices.amountCents} else 0 end), 0)`,
        pendingCount: sql<number>`count(case when ${invoices.status} = 'sent' then 1 end)`,
      })
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId)),

    // Winner claims this month
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(claims)
      .innerJoin(shows, eq(claims.showId, shows.id))
      .where(
        and(
          eq(shows.workspaceId, workspaceId),
          eq(claims.claimStatus, 'winner'),
          sql`${claims.createdAt} >= ${monthStart.toISOString()}`,
        ),
      ),

    // Active show
    db
      .select({ id: shows.id, name: shows.name })
      .from(shows)
      .where(and(eq(shows.workspaceId, workspaceId), eq(shows.status, 'active')))
      .limit(1),

    // Stale carts (sent > 24h ago)
    db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, 'sent'),
          sql`${invoices.sentAt} < ${staleThreshold.toISOString()}`,
        ),
      ),

    // Error carts
    db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.status, 'error'))),

    // Stripe connected
    db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, 'stripe'),
          eq(integrations.status, 'active'),
        ),
      )
      .limit(1),

    // Recent shows with per-show stats
    db.execute(sql`
      SELECT
        s.id, s.name, s.status, s.created_at, s.started_at,
        coalesce(claim_stats.items_sold, 0) as items_sold,
        coalesce(inv_stats.revenue_collected_cents, 0) as revenue_collected_cents,
        coalesce(inv_stats.carts_pending, 0) as carts_pending
      FROM shows s
      LEFT JOIN LATERAL (
        SELECT count(*) as items_sold
        FROM claims c
        WHERE c.show_id = s.id AND c.claim_status = 'winner'
      ) claim_stats ON true
      LEFT JOIN LATERAL (
        SELECT
          coalesce(sum(case when i.status = 'paid' then i.amount_cents else 0 end), 0) as revenue_collected_cents,
          count(case when i.status = 'sent' then 1 end) as carts_pending
        FROM invoices i
        WHERE i.show_id = s.id
      ) inv_stats ON true
      WHERE s.workspace_id = ${workspaceId}
      ORDER BY s.created_at DESC
      LIMIT 10
    `),
  ]);

  const agg = invoiceAgg[0];
  const recentShows = (recentShowsResult.rows as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    startedAt: row.started_at
      ? row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at)
      : null,
    itemsSold: Number(row.items_sold),
    revenueCollectedCents: Number(row.revenue_collected_cents),
    cartsPending: Number(row.carts_pending),
  }));

  return NextResponse.json({
    data: {
      revenue: {
        collectedCents: Number(agg?.collectedCents ?? 0),
        pendingCents: Number(agg?.pendingCents ?? 0),
        pendingCount: Number(agg?.pendingCount ?? 0),
      },
      itemsSoldThisMonth: Number(itemsSoldResult[0]?.count ?? 0),
      activeShow: activeShowResult[0] ?? null,
      attention: {
        staleCarts: Number(staleCartsResult[0]?.count ?? 0),
        errorCarts: Number(errorCartsResult[0]?.count ?? 0),
        stripeConnected: stripeResult.length > 0,
      },
      recentShows,
    },
  });
});
