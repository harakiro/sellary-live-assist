import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
  const invoiceId = context?.params?.id;
  if (!invoiceId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Cart ID required' } },
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
      { error: { code: 'NOT_FOUND', message: 'Cart not found' } },
      { status: 404 },
    );
  }

  if (invoice.status === 'paid') {
    return NextResponse.json({ data: { id: invoice.id, status: 'paid' } });
  }

  await db
    .update(invoices)
    .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  return NextResponse.json({ data: { id: invoiceId, status: 'paid' } });
});
