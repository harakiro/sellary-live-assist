import Stripe from 'stripe';
import { db } from '@/lib/db';
import { invoices, integrations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { broadcastToShow } from '@/lib/realtime/server';
import type { StripeCredentials } from '@/lib/integrations/stripe/types';

/**
 * Resolve the workspace's Stripe credentials from the webhook payload.
 * Parses the raw JSON (pre-verification, read-only) to extract the checkout
 * session ID, then looks up invoices → integrations → decrypted credentials.
 */
async function resolveCredentials(rawBody: string): Promise<StripeCredentials | null> {
  let sessionId: string | undefined;
  try {
    const payload = JSON.parse(rawBody);
    sessionId = payload?.data?.object?.id;
  } catch {
    return null;
  }

  if (!sessionId) return null;

  const [invoice] = await db
    .select({ integrationId: invoices.integrationId })
    .from(invoices)
    .where(eq(invoices.externalId, sessionId));

  if (!invoice) return null;

  const [integration] = await db
    .select({ credentialsEnc: integrations.credentialsEnc })
    .from(integrations)
    .where(eq(integrations.id, invoice.integrationId));

  if (!integration?.credentialsEnc) return null;

  return JSON.parse(decrypt(integration.credentialsEnc)) as StripeCredentials;
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<{ processed: boolean; eventType?: string }> {
  const credentials = await resolveCredentials(rawBody);
  if (!credentials) {
    // Can't identify the workspace — not our event. Return silently to avoid
    // Stripe retry storms for events that don't match any invoice.
    return { processed: false };
  }

  // Use DB-stored webhook secret (production) or env var fallback (dev with Stripe CLI)
  const webhookSecret = credentials.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      'Stripe integration is missing webhook secret — please disconnect and reconnect Stripe, or set STRIPE_WEBHOOK_SECRET for local development',
    );
  }

  const stripe = new Stripe(credentials.secretKey, { apiVersion: '2026-01-28.clover' });
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.externalId, session.id));

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

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.externalId, session.id));

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: 'void',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoice.id));

        broadcastToShow(invoice.showId, {
          type: 'invoice.updated' as any,
          data: {
            invoiceId: invoice.id,
            showId: invoice.showId,
            buyerHandle: invoice.buyerHandle,
            status: 'void',
            timestamp: new Date().toISOString(),
          },
        });
      }
      break;
    }

    default:
      return { processed: false, eventType: event.type };
  }

  return { processed: true, eventType: event.type };
}
