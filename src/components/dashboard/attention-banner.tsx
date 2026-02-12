'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

type AttentionBannerProps = {
  staleCarts: number;
  errorCarts: number;
  stripeConnected: boolean;
};

export function AttentionBanner({ staleCarts, errorCarts, stripeConnected }: AttentionBannerProps) {
  const items: Array<{ text: string; href: string }> = [];

  if (staleCarts > 0) {
    items.push({
      text: `${staleCarts} cart${staleCarts !== 1 ? 's' : ''} pending for more than 24 hours`,
      href: '/carts?status=pending&sort=oldest',
    });
  }

  if (errorCarts > 0) {
    items.push({
      text: `${errorCarts} cart${errorCarts !== 1 ? 's' : ''} with errors`,
      href: '/carts?status=error',
    });
  }

  if (!stripeConnected) {
    items.push({
      text: 'Stripe not connected',
      href: '/integrations',
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">Needs Attention</h3>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-sm text-amber-700 hover:text-amber-900 hover:underline"
            >
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
