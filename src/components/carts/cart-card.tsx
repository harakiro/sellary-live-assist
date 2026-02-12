'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle, Send, ExternalLink } from 'lucide-react';
import { formatCents, formatRelativeDate } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from './status-badge';
import type { Cart } from './types';

type CartCardProps = {
  cart: Cart;
  onUpdate?: () => void;
};

export function CartCard({ cart, onUpdate }: CartCardProps) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'failed'>('idle');

  const items = Array.isArray(cart.lineItems) ? cart.lineItems : [];
  const buyerLabel = cart.buyerHandle || cart.buyerPlatformId || 'Unknown';

  async function copyLink() {
    if (cart.externalUrl) {
      await navigator.clipboard.writeText(cart.externalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function sendLink() {
    setSending(true);
    setSendStatus('idle');
    const res = await apiFetch<{ sent: boolean }>(`/api/shows/${cart.showId}/invoices/${cart.id}/send`, {
      method: 'POST',
    });
    if ('data' in res && res.data.sent) {
      setSendStatus('sent');
      setTimeout(() => setSendStatus('idle'), 2000);
    } else {
      setSendStatus('failed');
      setTimeout(() => setSendStatus('idle'), 3000);
    }
    setSending(false);
  }

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{buyerLabel}</span>
        <StatusBadge cartId={cart.id} status={cart.status} onUpdate={onUpdate} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href={`/shows/${cart.showId}`} className="text-gray-500 hover:text-brand-600">
          {cart.showName}
        </Link>
        <span className="font-medium text-gray-900">
          {formatCents(cart.amountCents, cart.currency ?? undefined)}
        </span>
      </div>

      {items.length > 0 && (
        <p className="text-xs text-gray-500">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">{formatRelativeDate(cart.createdAt)}</span>
        <div className="flex items-center gap-1">
          {cart.externalUrl && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyLink} title="Copy link">
                {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a href={cart.externalUrl} target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </>
          )}
          {cart.status !== 'paid' && cart.status !== 'void' && cart.externalUrl && (
            <Button
              size="sm"
              variant={sendStatus === 'sent' ? 'default' : sendStatus === 'failed' ? 'destructive' : 'outline'}
              onClick={sendLink}
              disabled={sending}
              className="text-xs h-7"
            >
              {sendStatus === 'sent' ? (
                <><CheckCircle className="h-3 w-3 mr-1" />Sent</>
              ) : (
                <><Send className="h-3 w-3 mr-1" />{sending ? '...' : 'Send'}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
