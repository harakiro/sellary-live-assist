'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Send, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type InvoiceRowProps = {
  invoice: {
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
  showId: string;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid': return 'success' as const;
    case 'sent': return 'default' as const;
    case 'draft': return 'secondary' as const;
    case 'error': return 'destructive' as const;
    case 'void': return 'outline' as const;
    default: return 'secondary' as const;
  }
};

function formatCents(cents: number | null, currency: string | null): string {
  if (cents == null) return '-';
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

export function InvoiceRow({ invoice, showId }: InvoiceRowProps) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function sendLink() {
    setSending(true);
    await apiFetch(`/api/shows/${showId}/invoices/${invoice.id}/send`, { method: 'POST' });
    setSending(false);
  }

  async function copyLink() {
    if (invoice.externalUrl) {
      await navigator.clipboard.writeText(invoice.externalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {invoice.buyerHandle || invoice.buyerPlatformId}
        </div>
        <div className="text-xs text-gray-500">
          {items.length} item{items.length !== 1 ? 's' : ''} &middot; {formatCents(invoice.amountCents, invoice.currency)}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Badge variant={statusBadge(invoice.status)}>{invoice.status}</Badge>

        {invoice.externalUrl && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={copyLink}
              title="Copy checkout link"
            >
              {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <a
              href={invoice.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Stripe"
            >
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        )}

        {invoice.status !== 'paid' && invoice.status !== 'void' && invoice.externalUrl && (
          <Button
            size="sm"
            variant="outline"
            onClick={sendLink}
            disabled={sending}
            className="text-xs h-7"
          >
            <Send className="h-3 w-3 mr-1" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        )}
      </div>
    </div>
  );
}
