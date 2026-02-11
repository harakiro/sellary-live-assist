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

    // Find or create customer by searching for metadata
    const customers = await stripe.customers.search({
      query: `metadata["platform_user_id"]:"${params.buyerPlatformId}"`,
      limit: 1,
    });

    let customer: Stripe.Customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        name: params.buyerHandle,
        email: params.buyerEmail,
        metadata: {
          platform_user_id: params.buyerPlatformId,
          buyer_handle: params.buyerHandle,
        },
      });
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 7,
      description: params.memo || `Your claims from ${params.showName}`,
      metadata: {
        show_name: params.showName,
        buyer_handle: params.buyerHandle,
      },
    });

    // Add line items
    for (const item of params.lineItems) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id!,
        description: `#${item.itemNumber} — ${item.title}`,
        quantity: item.quantity,
        unit_amount_decimal: item.unitAmountCents.toString(),
        currency: params.currency || 'usd',
      });
    }

    // Finalize the invoice
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

    return {
      externalId: finalized.id!,
      externalUrl: finalized.hosted_invoice_url || '',
      amountCents: finalized.amount_due,
      currency: finalized.currency,
      status: 'sent',
    };
  },

  async getInvoiceStatus(externalId: string, credentialsEnc: string): Promise<InvoiceStatusResult> {
    const stripe = getClient(credentialsEnc);
    const invoice = await stripe.invoices.retrieve(externalId);

    let status: InvoiceStatusResult['status'] = 'draft';
    if (invoice.status === 'paid') status = 'paid';
    else if (invoice.status === 'void') status = 'void';
    else if (invoice.status === 'open') status = 'sent';
    else if (invoice.status === 'uncollectible') status = 'error';

    return {
      status,
      amountCents: invoice.amount_due,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : undefined,
    };
  },
};
