import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  const invoiceId = context.params.id;

  const [invoice] = await db
    .select({ externalUrl: invoices.externalUrl, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice || !invoice.externalUrl) {
    return NextResponse.json(
      { error: 'Checkout link not found or expired' },
      { status: 404 },
    );
  }

  if (invoice.status === 'paid') {
    return NextResponse.redirect(
      new URL('/checkout/success', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    );
  }

  if (invoice.status === 'void') {
    return NextResponse.json(
      { error: 'This checkout link has expired' },
      { status: 410 },
    );
  }

  return NextResponse.redirect(invoice.externalUrl);
}
