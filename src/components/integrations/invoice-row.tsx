'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Send, Copy, CheckCircle, MessageCircle, Trash2 } from 'lucide-react';
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
    errorMessage: string | null;
    sentAt: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  showId: string;
  onDelete?: (invoiceId: string) => void;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid': return 'success' as const;
    case 'sent': return 'default' as const;
    case 'prompted': return 'warning' as const;
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

export function InvoiceRow({ invoice, showId, onDelete }: InvoiceRowProps) {
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'failed' | 'prompted'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [displayStatus, setDisplayStatus] = useState(invoice.status);

  async function sendLink() {
    setSending(true);
    setSendStatus('idle');
    setSendError(null);

    const res = await apiFetch<{
      sent: boolean;
      prompted?: boolean;
      error?: string;
    }>(`/api/shows/${showId}/invoices/${invoice.id}/send`, { method: 'POST' });

    if ('data' in res && res.data.sent) {
      setSendStatus('sent');
      setDisplayStatus('sent');
      setTimeout(() => setSendStatus('idle'), 2000);
    } else if ('data' in res && res.data.prompted) {
      setSendStatus('prompted');
      setDisplayStatus('prompted');
    } else {
      setSendStatus('failed');
      const errMsg = 'data' in res ? res.data.error : 'error' in res ? res.error.message : 'Send failed';
      setSendError(errMsg || 'DM failed — copy link instead');
      setTimeout(() => {
        setSendStatus('idle');
        setSendError(null);
      }, 8000);
    }

    setSending(false);
  }

  async function deleteInvoice() {
    setDeleting(true);
    const res = await apiFetch<{ deleted: boolean }>(
      `/api/shows/${showId}/invoices/${invoice.id}`,
      { method: 'DELETE' },
    );
    if ('data' in res && res.data.deleted) {
      onDelete?.(invoice.id);
    }
    setDeleting(false);
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
        {displayStatus === 'error' && invoice.errorMessage && (
          <div className="text-xs text-red-600 mt-0.5 truncate" title={invoice.errorMessage}>
            {invoice.errorMessage}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-4">
        <Badge variant={statusBadge(displayStatus)}>{displayStatus}</Badge>

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

        {displayStatus !== 'paid' && displayStatus !== 'void' && invoice.externalUrl && (
          <div className="relative">
            <Button
              size="sm"
              variant={
                sendStatus === 'sent' ? 'default'
                  : sendStatus === 'failed' ? 'destructive'
                  : sendStatus === 'prompted' ? 'outline'
                  : 'outline'
              }
              onClick={sendLink}
              disabled={sending}
              className={`text-xs h-7${sendStatus === 'prompted' ? ' border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}`}
            >
              {sendStatus === 'sent' ? (
                <><CheckCircle className="h-3 w-3 mr-1" />Sent!</>
              ) : sendStatus === 'failed' ? (
                <><Send className="h-3 w-3 mr-1" />Failed</>
              ) : sendStatus === 'prompted' ? (
                <><MessageCircle className="h-3 w-3 mr-1" />Prompted</>
              ) : (
                <><Send className="h-3 w-3 mr-1" />{sending ? 'Sending...' : 'Send'}</>
              )}
            </Button>
            {sendError && sendStatus === 'failed' && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2.5 py-1.5 w-64 shadow-sm">
                {sendError}
              </div>
            )}
            {sendStatus === 'prompted' && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-2.5 py-1.5 w-64 shadow-sm">
                Replied to their comment asking them to DM your Page. Click Send again once they message you.
              </div>
            )}
          </div>
        )}

        {displayStatus !== 'paid' && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-gray-400 hover:text-red-600"
            onClick={deleteInvoice}
            disabled={deleting}
            title="Delete checkout link"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
