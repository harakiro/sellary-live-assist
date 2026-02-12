'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle, Send, ExternalLink } from 'lucide-react';
import { formatCents, formatRelativeDate } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from './status-badge';
import type { Cart } from './types';

type CartRowProps = {
  cart: Cart;
  onUpdate?: () => void;
};

export function CartRow({ cart, onUpdate }: CartRowProps) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'failed'>('idle');

  const items = Array.isArray(cart.lineItems) ? cart.lineItems : [];
  const itemCount = items.length;

  const buyerLabel = cart.buyerHandle || cart.buyerPlatformId || 'Unknown';
  const profileUrl = cart.showPlatform === 'instagram'
    ? `https://instagram.com/${cart.buyerHandle}`
    : cart.buyerPlatformId
      ? `https://facebook.com/${cart.buyerPlatformId}`
      : null;

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
    <tr className="hover:bg-gray-50 border-b last:border-b-0">
      <td className="py-3 pl-4 pr-4">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {buyerLabel}
          </a>
        ) : (
          <span className="text-sm font-medium text-gray-900">{buyerLabel}</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <Link href={`/shows/${cart.showId}`} className="text-sm text-gray-700 hover:text-brand-600">
          {cart.showName}
        </Link>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500 text-center">
        {itemCount || '-'}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-900 font-medium text-right">
        {formatCents(cart.amountCents, cart.currency ?? undefined)}
      </td>
      <td className="py-3 pr-4 text-center">
        <StatusBadge cartId={cart.id} status={cart.status} onUpdate={onUpdate} />
      </td>
      <td className="py-3 pr-4 text-sm text-gray-500">
        {formatRelativeDate(cart.createdAt)}
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-1">
          {cart.externalUrl && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyLink} title="Copy link">
                {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a href={cart.externalUrl} target="_blank" rel="noopener noreferrer" title="View on Stripe">
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
              ) : sendStatus === 'failed' ? (
                <><Send className="h-3 w-3 mr-1" />Failed</>
              ) : (
                <><Send className="h-3 w-3 mr-1" />{sending ? '...' : 'Send'}</>
              )}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
