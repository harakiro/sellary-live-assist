import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { sendCheckoutDM } from '@/lib/platforms/messaging';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  const pendingInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.status, 'sent'),
        isNotNull(invoices.externalUrl),
      ),
    );

  const results: Array<{
    invoiceId: string;
    buyerHandle: string | null;
    success: boolean;
    error?: string;
  }> = [];

  // Process with concurrency limit of 3
  const concurrency = 3;
  for (let i = 0; i < pendingInvoices.length; i += concurrency) {
    const batch = pendingInvoices.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (inv) => {
        const dmResult = await sendCheckoutDM({
          showId: inv.showId,
          buyerPlatformId: inv.buyerPlatformId || '',
          buyerHandle: inv.buyerHandle,
          checkoutUrl: inv.externalUrl!,
        });

        if (dmResult.sent) {
          await db
            .update(invoices)
            .set({ sentAt: new Date(), updatedAt: new Date() })
            .where(eq(invoices.id, inv.id));
        }

        return {
          invoiceId: inv.id,
          buyerHandle: inv.buyerHandle,
          success: dmResult.sent,
          error: dmResult.error,
        };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          invoiceId: 'unknown',
          buyerHandle: null,
          success: false,
          error: 'Unexpected error',
        });
      }
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    data: {
      total: pendingInvoices.length,
      sent,
      failed,
      results,
    },
  });
});
