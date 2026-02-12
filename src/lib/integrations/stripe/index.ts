import Stripe from 'stripe';
import { encrypt, decrypt } from '@/lib/encryption';
import type { IntegrationAdapter, InvoiceParams, InvoiceResult, InvoiceStatusResult } from '../types';
import type { StripeCredentials } from './types';

function getClient(credentialsEnc: string): Stripe {
  const creds: StripeCredentials = JSON.parse(decrypt(credentialsEnc));
  return new Stripe(creds.secretKey, { apiVersion: '2026-01-28.clover' });
}

export const stripeAdapter: IntegrationAdapter = {
  provider: 'stripe',
  displayName: 'Stripe',
  description: 'Accept payments and generate invoices for claimed items',

  async validateCredentials(credentials: Record<string, string>) {
    const { secretKey, publishableKey } = credentials;
    if (!secretKey || !publishableKey) {
      return { valid: false, error: 'Both secretKey and publishableKey are required' };
    }
    if (!secretKey.startsWith('sk_')) {
      return { valid: false, error: 'Invalid secret key format (must start with sk_)' };
    }
    if (!publishableKey.startsWith('pk_')) {
      return { valid: false, error: 'Invalid publishable key format (must start with pk_)' };
    }
    try {
      const stripe = new Stripe(secretKey, { apiVersion: '2026-01-28.clover' });
      await stripe.balance.retrieve();
      return { valid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to validate Stripe keys';
      return { valid: false, error: message };
    }
  },

  async testConnection(credentialsEnc: string) {
    try {
      const stripe = getClient(credentialsEnc);
      await stripe.balance.retrieve();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return { ok: false, error: message };
    }
  },

  async createInvoice(params: InvoiceParams): Promise<InvoiceResult> {
    const stripe = getClient(params.credentialsEnc);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const currency = params.currency || 'usd';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      shipping_address_collection: { allowed_countries: ['US'] },
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency,
          unit_amount: item.unitAmountCents,
          product_data: {
            name: `#${item.itemNumber} — ${item.title}`,
          },
        },
        quantity: item.quantity,
      })),
      metadata: {
        show_id: params.showId,
        show_name: params.showName,
        buyer_handle: params.buyerHandle,
        buyer_platform_id: params.buyerPlatformId,
      },
      success_url: `${appUrl}/checkout/success`,
      cancel_url: `${appUrl}/checkout/cancelled`,
    });

    const amountCents = params.lineItems.reduce(
      (sum, item) => sum + item.unitAmountCents * item.quantity,
      0,
    );

    return {
      externalId: session.id,
      externalUrl: session.url || '',
      amountCents,
      currency,
      status: 'sent',
    };
  },

  async getInvoiceStatus(externalId: string, credentialsEnc: string): Promise<InvoiceStatusResult> {
    const stripe = getClient(credentialsEnc);
    const session = await stripe.checkout.sessions.retrieve(externalId);

    let status: InvoiceStatusResult['status'] = 'sent';
    if (session.payment_status === 'paid') status = 'paid';
    else if (session.status === 'expired') status = 'void';

    const amountCents = session.amount_total ?? 0;

    return {
      status,
      amountCents,
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
    };
  },
};
