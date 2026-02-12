import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createShowSchema } from '@/lib/validations/shows';

async function listShows(req: AuthenticatedRequest) {
  const { workspaceId } = req.auth;

  const result = await db.execute(sql`
    SELECT
      s.*,
      coalesce(cs.unique_buyers, 0) as unique_buyers,
      coalesce(cs.items_sold, 0) as items_sold,
      coalesce(cms.unique_commenters, 0) as unique_commenters,
      coalesce(inv.revenue_cents, 0) as revenue_cents,
      coalesce(inv.carts_paid, 0) as carts_paid,
      coalesce(inv.carts_pending, 0) as carts_pending
    FROM shows s
    LEFT JOIN LATERAL (
      SELECT
        count(DISTINCT c.platform_user_id) as unique_buyers,
        count(*) as items_sold
      FROM claims c
      WHERE c.show_id = s.id AND c.claim_status = 'winner'
    ) cs ON true
    LEFT JOIN LATERAL (
      SELECT count(DISTINCT cm.platform_user_id) as unique_commenters
      FROM comments cm
      WHERE cm.show_id = s.id
    ) cms ON true
    LEFT JOIN LATERAL (
      SELECT
        coalesce(sum(case when i.status = 'paid' then i.amount_cents else 0 end), 0) as revenue_cents,
        count(case when i.status = 'paid' then 1 end) as carts_paid,
        count(case when i.status = 'sent' or i.status = 'draft' then 1 end) as carts_pending
      FROM invoices i
      WHERE i.show_id = s.id
    ) inv ON true
    WHERE s.workspace_id = ${workspaceId}
    ORDER BY s.created_at DESC
  `);

  const data = (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    platform: row.platform as string | null,
    claimWord: row.claim_word as string,
    passWord: row.pass_word as string,
    startedAt: row.started_at ? String(row.started_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    workspaceId: row.workspace_id as string,
    connectionId: row.connection_id as string | null,
    liveId: row.live_id as string | null,
    liveUrl: row.live_url as string | null,
    uniqueBuyers: Number(row.unique_buyers),
    uniqueCommenters: Number(row.unique_commenters),
    itemsSold: Number(row.items_sold),
    revenueCents: Number(row.revenue_cents),
    cartsPaid: Number(row.carts_paid),
    cartsPending: Number(row.carts_pending),
  }));

  return NextResponse.json({ data });
}

async function createShow(req: AuthenticatedRequest) {
  const body = await req.json();
  const parsed = createShowSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const { workspaceId } = req.auth;

  const [show] = await db
    .insert(shows)
    .values({
      workspaceId,
      name: parsed.data.name,
      platform: parsed.data.platform,
      connectionId: parsed.data.connectionId,
      claimWord: parsed.data.claimWord,
      passWord: parsed.data.passWord,
      autoNumberEnabled: parsed.data.autoNumberEnabled,
      autoNumberStart: parsed.data.autoNumberStart,
    })
    .returning();

  return NextResponse.json({ data: show }, { status: 201 });
}

export const GET = withAuth(listShows);
export const POST = withAuth(createShow);
