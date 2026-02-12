import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const GET = withAuth(async (req: AuthenticatedRequest, context) => {
  const showId = context?.params?.id;
  if (!showId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const { workspaceId } = req.auth;

  const records = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.showId, showId), eq(invoices.workspaceId, workspaceId)))
    .orderBy(desc(invoices.createdAt));

  const data = records.map((inv) => ({
    id: inv.id,
    buyerHandle: inv.buyerHandle,
    buyerPlatformId: inv.buyerPlatformId,
    status: inv.status,
    amountCents: inv.amountCents,
    currency: inv.currency,
    lineItems: inv.lineItems,
    externalUrl: inv.externalUrl,
    errorMessage: inv.errorMessage,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
  }));

  return NextResponse.json({ data });
});
