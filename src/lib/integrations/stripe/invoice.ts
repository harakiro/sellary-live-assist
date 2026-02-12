import { db } from '@/lib/db';
import { claims, showItems, invoices, integrations, shows } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAdapter } from '../registry';
import type { InvoiceLineItem } from '../types';

type BuyerRollup = {
  platformUserId: string;
  userHandle: string | null;
  items: {
    itemNumber: string;
    title: string;
    price: number | null;
    quantity: number;
  }[];
};

export async function getBuyerRollup(showId: string): Promise<BuyerRollup[]> {
  // Get all winner claims for this show, joined with item info
  const winnerClaims = await db
    .select({
      platformUserId: claims.platformUserId,
      userHandle: claims.userHandle,
      itemNumber: claims.itemNumber,
      showItemId: claims.showItemId,
    })
    .from(claims)
    .where(and(eq(claims.showId, showId), eq(claims.claimStatus, 'winner')));

  // Get item details
  const itemIds = [...new Set(winnerClaims.filter(c => c.showItemId).map(c => c.showItemId!))];
  const itemDetails = itemIds.length > 0
    ? await db.select().from(showItems).where(inArray(showItems.id, itemIds))
    : [];
  const itemMap = new Map(itemDetails.map(i => [i.id, i]));

  // Group by buyer
  const buyerMap = new Map<string, BuyerRollup>();
  for (const claim of winnerClaims) {
    if (!buyerMap.has(claim.platformUserId)) {
      buyerMap.set(claim.platformUserId, {
        platformUserId: claim.platformUserId,
        userHandle: claim.userHandle,
        items: [],
      });
    }
    const buyer = buyerMap.get(claim.platformUserId)!;
    const item = claim.showItemId ? itemMap.get(claim.showItemId) : null;
    buyer.items.push({
      itemNumber: claim.itemNumber,
      title: item?.title || `Item #${claim.itemNumber}`,
      price: item?.price ?? null,
      quantity: 1,
    });
  }

  return Array.from(buyerMap.values());
}

type GenerateResult = {
  generated: number;
  failed: number;
  skipped: number;
  results: {
    buyerHandle: string | null;
    buyerPlatformId: string;
    status: 'created' | 'skipped' | 'error';
    invoiceId?: string;
    externalUrl?: string;
    error?: string;
  }[];
};

export async function generateInvoicesForShow(
  showId: string,
  workspaceId: string,
): Promise<GenerateResult> {
  // Get Stripe integration
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, 'stripe')));

  if (!integration || integration.status !== 'active' || !integration.credentialsEnc) {
    throw new Error('Stripe integration is not active');
  }

  // Get show info
  const [show] = await db.select().from(shows).where(eq(shows.id, showId));
  if (!show) throw new Error('Show not found');

  const adapter = getAdapter('stripe');
  if (!adapter?.createInvoice) throw new Error('Stripe adapter does not support invoicing');

  const buyers = await getBuyerRollup(showId);
  const result: GenerateResult = { generated: 0, failed: 0, skipped: 0, results: [] };

  for (const buyer of buyers) {
    // Check for existing invoice (idempotency)
    const [existing] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.showId, showId),
          eq(invoices.buyerPlatformId, buyer.platformUserId),
        ),
      );

    if (existing && existing.status !== 'error') {
      result.skipped++;
      result.results.push({
        buyerHandle: buyer.userHandle,
        buyerPlatformId: buyer.platformUserId,
        status: 'skipped',
        invoiceId: existing.id,
      });
      continue;
    }

    // Delete previous error record so we can retry
    if (existing && existing.status === 'error') {
      await db.delete(invoices).where(eq(invoices.id, existing.id));
    }

    try {
      const lineItems: InvoiceLineItem[] = buyer.items.map((item) => ({
        itemNumber: item.itemNumber,
        title: item.title,
        quantity: item.quantity,
        unitAmountCents: item.price ?? 0,
      }));

      const invoiceResult = await adapter.createInvoice({
        credentialsEnc: integration.credentialsEnc,
        showId,
        buyerHandle: buyer.userHandle || buyer.platformUserId,
        buyerPlatformId: buyer.platformUserId,
        showName: show.name,
        lineItems,
        currency: (integration.settings as Record<string, unknown>)?.currency as string || 'usd',
        memo: (integration.settings as Record<string, unknown>)?.invoiceMemo as string || undefined,
      });

      // Store invoice record
      const [invoice] = await db.insert(invoices).values({
        workspaceId,
        showId,
        integrationId: integration.id,
        provider: 'stripe',
        externalId: invoiceResult.externalId,
        externalUrl: invoiceResult.externalUrl,
        buyerHandle: buyer.userHandle,
        buyerPlatformId: buyer.platformUserId,
        status: invoiceResult.status,
        amountCents: invoiceResult.amountCents,
        currency: invoiceResult.currency,
        lineItems: lineItems,
        sentAt: new Date(),
      }).returning();

      result.generated++;
      result.results.push({
        buyerHandle: buyer.userHandle,
        buyerPlatformId: buyer.platformUserId,
        status: 'created',
        invoiceId: invoice.id,
        externalUrl: invoiceResult.externalUrl,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `[invoice-gen] Failed for buyer ${buyer.userHandle || buyer.platformUserId} on show ${showId}:`,
        err,
      );

      // Persist a failed invoice record so the error is visible in the UI
      try {
        const lineItems: InvoiceLineItem[] = buyer.items.map((item) => ({
          itemNumber: item.itemNumber,
          title: item.title,
          quantity: item.quantity,
          unitAmountCents: item.price ?? 0,
        }));

        await db.insert(invoices).values({
          workspaceId,
          showId,
          integrationId: integration.id,
          provider: 'stripe',
          buyerHandle: buyer.userHandle,
          buyerPlatformId: buyer.platformUserId,
          status: 'error',
          errorMessage,
          lineItems,
        });
      } catch (dbErr) {
        console.error('[invoice-gen] Failed to persist error invoice record:', dbErr);
      }

      result.failed++;
      result.results.push({
        buyerHandle: buyer.userHandle,
        buyerPlatformId: buyer.platformUserId,
        status: 'error',
        error: errorMessage,
      });
    }
  }

  return result;
}
