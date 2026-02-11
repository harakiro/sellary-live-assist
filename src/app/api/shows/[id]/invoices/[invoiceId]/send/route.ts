import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
  const invoiceId = context?.params?.invoiceId;
  if (!invoiceId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invoice ID required' } },
      { status: 400 },
    );
  }

  const { workspaceId } = req.auth;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)));

  if (!invoice) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      { status: 404 },
    );
  }

  if (!invoice.externalUrl) {
    return NextResponse.json(
      { error: { code: 'NO_CHECKOUT_URL', message: 'Invoice has no checkout URL' } },
      { status: 400 },
    );
  }

  // Update sent timestamp
  await db
    .update(invoices)
    .set({ sentAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  // Return the checkout URL for manual sharing
  // (Facebook DM sending would require pages_messaging permission, deferred)
  return NextResponse.json({
    data: {
      invoiceId: invoice.id,
      buyerHandle: invoice.buyerHandle,
      checkoutUrl: invoice.externalUrl,
      sent: true,
    },
  });
});
