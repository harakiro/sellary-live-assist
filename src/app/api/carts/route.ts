import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices, shows } from '@/lib/db/schema';
import { eq, and, sql, desc, asc, lt, gt, or } from 'drizzle-orm';

const VALID_STATUSES = ['sent', 'paid', 'void', 'error', 'draft'] as const;
const VALID_SORTS = ['newest', 'oldest', 'amount_desc', 'amount_asc'] as const;

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const showId = url.searchParams.get('showId');
  const sort = url.searchParams.get('sort') || 'newest';
  const cursor = url.searchParams.get('cursor');
  const limitParam = parseInt(url.searchParams.get('limit') || '25', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);

  // Build conditions
  const conditions = [eq(invoices.workspaceId, workspaceId)];

  if (statusParam) {
    if (statusParam === 'pending') {
      conditions.push(or(eq(invoices.status, 'sent'), eq(invoices.status, 'draft'))!);
    } else if (VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])) {
      conditions.push(eq(invoices.status, statusParam as (typeof VALID_STATUSES)[number]));
    }
  }

  if (showId) {
    conditions.push(eq(invoices.showId, showId));
  }

  if (cursor) {
    if (sort === 'newest') {
      conditions.push(lt(invoices.createdAt, new Date(cursor)));
    } else if (sort === 'oldest') {
      conditions.push(gt(invoices.createdAt, new Date(cursor)));
    }
    // For amount sorts, use cursor as composite "amount:id"
  }

  // Determine sort order
  let orderBy;
  switch (sort) {
    case 'oldest':
      orderBy = asc(invoices.createdAt);
      break;
    case 'amount_desc':
      orderBy = desc(invoices.amountCents);
      break;
    case 'amount_asc':
      orderBy = asc(invoices.amountCents);
      break;
    default:
      orderBy = desc(invoices.createdAt);
  }

  // Fetch carts + 1 extra to detect hasMore
  const rows = await db
    .select({
      id: invoices.id,
      showId: invoices.showId,
      showName: shows.name,
      showPlatform: shows.platform,
      buyerHandle: invoices.buyerHandle,
      buyerPlatformId: invoices.buyerPlatformId,
      status: invoices.status,
      amountCents: invoices.amountCents,
      currency: invoices.currency,
      lineItems: invoices.lineItems,
      externalUrl: invoices.externalUrl,
      errorMessage: invoices.errorMessage,
      sentAt: invoices.sentAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(shows, eq(invoices.showId, shows.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const carts = rows.slice(0, limit).map((r) => ({
    id: r.id,
    showId: r.showId,
    showName: r.showName,
    showPlatform: r.showPlatform,
    buyerHandle: r.buyerHandle,
    buyerPlatformId: r.buyerPlatformId,
    status: r.status,
    amountCents: r.amountCents,
    currency: r.currency,
    lineItems: r.lineItems as Array<{
      itemNumber: string;
      title: string;
      quantity: number;
      unitAmountCents: number;
    }> | null,
    externalUrl: r.externalUrl,
    errorMessage: r.errorMessage,
    sentAt: r.sentAt?.toISOString() ?? null,
    paidAt: r.paidAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const lastCart = carts[carts.length - 1];
  const nextCursor = hasMore && lastCart ? lastCart.createdAt : null;

  // Counts (unfiltered for tab badges)
  const countResult = await db
    .select({
      all: sql<number>`count(*)`,
      sent: sql<number>`count(case when ${invoices.status} = 'sent' or ${invoices.status} = 'draft' then 1 end)`,
      paid: sql<number>`count(case when ${invoices.status} = 'paid' then 1 end)`,
      void: sql<number>`count(case when ${invoices.status} = 'void' then 1 end)`,
      error: sql<number>`count(case when ${invoices.status} = 'error' then 1 end)`,
    })
    .from(invoices)
    .where(eq(invoices.workspaceId, workspaceId));

  const c = countResult[0];

  return NextResponse.json({
    data: {
      carts,
      counts: {
        all: Number(c?.all ?? 0),
        sent: Number(c?.sent ?? 0),
        paid: Number(c?.paid ?? 0),
        void: Number(c?.void ?? 0),
        error: Number(c?.error ?? 0),
      },
      hasMore,
      nextCursor,
    },
  });
});
