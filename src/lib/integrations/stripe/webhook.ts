import Stripe from 'stripe';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { broadcastToShow } from '@/lib/realtime/server';

export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<{ processed: boolean; eventType?: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  const stripe = new Stripe(webhookSecret, { apiVersion: '2026-01-28.clover' });
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('Invalid webhook signature');
  }

  switch (event.type) {
    case 'invoice.paid': {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.externalId, stripeInvoice.id));

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        broadcastToShow(invoice.showId, {
          type: 'invoice.updated' as any,
          data: {
            invoiceId: invoice.id,
            showId: invoice.showId,
            buyerHandle: invoice.buyerHandle,
            status: 'paid',
            timestamp: new Date().toISOString(),
          },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.externalId, stripeInvoice.id));

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: 'error',
            errorMessage: 'Payment failed',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        broadcastToShow(invoice.showId, {
          type: 'invoice.updated' as any,
          data: {
            invoiceId: invoice.id,
            showId: invoice.showId,
            buyerHandle: invoice.buyerHandle,
            status: 'error',
            timestamp: new Date().toISOString(),
          },
        });
      }
      break;
    }

    case 'invoice.voided': {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.externalId, stripeInvoice.id));

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: 'void',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));
      }
      break;
    }

    default:
      return { processed: false, eventType: event.type };
  }

  return { processed: true, eventType: event.type };
}
