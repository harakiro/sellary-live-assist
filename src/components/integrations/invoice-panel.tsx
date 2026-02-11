'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { InvoiceRow } from './invoice-row';
import { Receipt, Loader2 } from 'lucide-react';

type Invoice = {
  id: string;
  buyerHandle: string | null;
  buyerPlatformId: string;
  status: string;
  amountCents: number | null;
  currency: string | null;
  lineItems: unknown;
  externalUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type InvoicePanelProps = {
  showId: string;
  hasClaims: boolean;
};

export function InvoicePanel({ showId, hasClaims }: InvoicePanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    generated: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const fetchInvoices = useCallback(async () => {
    const res = await apiFetch<Invoice[]>(`/api/shows/${showId}/invoices`);
    if ('data' in res) setInvoices(res.data);
    setLoading(false);
  }, [showId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function generateInvoices() {
    setGenerating(true);
    setGenerateResult(null);
    const res = await apiFetch<{
      generated: number;
      failed: number;
      skipped: number;
      results: unknown[];
    }>(`/api/shows/${showId}/invoices/generate`, { method: 'POST' });

    if ('data' in res) {
      setGenerateResult({
        generated: res.data.generated,
        failed: res.data.failed,
        skipped: res.data.skipped,
      });
      fetchInvoices();
    }
    setGenerating(false);
  }

  // Allow external updates (e.g., from realtime events)
  const handleInvoiceUpdate = useCallback(
    (invoiceId: string, newStatus: string) => {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: newStatus } : inv,
        ),
      );
    },
    [],
  );

  // Expose update handler via global for the parent page to call
  useEffect(() => {
    (window as any).__invoicePanelUpdate = handleInvoiceUpdate;
    return () => { delete (window as any).__invoicePanelUpdate; };
  }, [handleInvoiceUpdate]);

  const paid = invoices.filter((i) => i.status === 'paid').length;
  const pending = invoices.filter((i) => i.status !== 'paid' && i.status !== 'void').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Invoices
            {invoices.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({paid} paid, {pending} pending)
              </span>
            )}
          </CardTitle>
          {hasClaims && (
            <Button
              size="sm"
              onClick={generateInvoices}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating...</>
              ) : (
                'Generate Invoices'
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {generateResult && (
          <div className="mb-4 text-sm bg-blue-50 text-blue-700 rounded-md px-3 py-2">
            Generated {generateResult.generated} invoice{generateResult.generated !== 1 ? 's' : ''}
            {generateResult.skipped > 0 && `, ${generateResult.skipped} skipped (already exist)`}
            {generateResult.failed > 0 && `, ${generateResult.failed} failed`}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">
            {hasClaims
              ? 'No invoices generated yet. Click "Generate Invoices" to create invoices for all buyers.'
              : 'No claims to invoice yet.'}
          </p>
        ) : (
          <div className="divide-y">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} showId={showId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
