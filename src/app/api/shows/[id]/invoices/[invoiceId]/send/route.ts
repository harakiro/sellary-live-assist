import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendCheckoutDM, getShortCheckoutUrl } from '@/lib/platforms/messaging';

export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
  const showId = context?.params?.id;
  const invoiceId = context?.params?.invoiceId;
  if (!invoiceId || !showId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Show ID and Invoice ID required' } },
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

  const dmResult = await sendCheckoutDM({
    showId,
    buyerPlatformId: invoice.buyerPlatformId || '',
    buyerHandle: invoice.buyerHandle,
    checkoutUrl: getShortCheckoutUrl(invoiceId),
  });

  if (dmResult.sent) {
    await db
      .update(invoices)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
  } else if (dmResult.prompted) {
    await db
      .update(invoices)
      .set({ status: 'prompted', updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
  }

  return NextResponse.json({
    data: {
      invoiceId: invoice.id,
      buyerHandle: invoice.buyerHandle,
      checkoutUrl: invoice.externalUrl,
      sent: dmResult.sent,
      prompted: dmResult.prompted,
      error: dmResult.error,
    },
  });
});
