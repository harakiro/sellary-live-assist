import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices, integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdapter } from '@/lib/integrations/registry';
import '@/lib/integrations/stripe/register';

export const DELETE = withAuth(async (req: AuthenticatedRequest, context) => {
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

  if (invoice.status === 'paid') {
    return NextResponse.json(
      { error: { code: 'CANNOT_DELETE', message: 'Cannot delete a paid invoice' } },
      { status: 400 },
    );
  }

  // Expire the checkout session on the provider
  if (invoice.externalId && invoice.integrationId) {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, invoice.integrationId));

    if (integration?.credentialsEnc) {
      const adapter = getAdapter(integration.provider);
      if (adapter?.expireInvoice) {
        const result = await adapter.expireInvoice(invoice.externalId, integration.credentialsEnc);
        if (!result.ok) {
          console.warn(`[invoice-delete] Failed to expire on provider: ${result.error}`);
        }
      }
    }
  }

  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  return NextResponse.json({ data: { deleted: true } });
});
