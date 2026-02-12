'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CartFilters } from '@/components/carts/cart-filters';
import { CartRow } from '@/components/carts/cart-row';
import { CartCard } from '@/components/carts/cart-card';
import { ResendAllDialog } from '@/components/carts/resend-all-dialog';
import type { Cart, CartCounts } from '@/components/carts/types';

type CartsResponse = {
  carts: Cart[];
  counts: CartCounts;
  hasMore: boolean;
  nextCursor: string | null;
};

export default function CartsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [carts, setCarts] = useState<Cart[]>([]);
  const [counts, setCounts] = useState<CartCounts>({ all: 0, sent: 0, paid: 0, void: 0, error: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || 'newest';

  const fetchCarts = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
    if (cursor) params.set('cursor', cursor);
    params.set('limit', '25');

    const res = await apiFetch<CartsResponse>(`/api/carts?${params.toString()}`);
    if ('data' in res) {
      return res.data;
    }
    return null;
  }, [status, sort]);

  useEffect(() => {
    setLoading(true);
    fetchCarts().then((data) => {
      if (data) {
        setCarts(data.carts);
        setCounts(data.counts);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchCarts]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const data = await fetchCarts(nextCursor);
    if (data) {
      setCarts((prev) => [...prev, ...data.carts]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/carts?${params.toString()}`);
  }

  function handleRefresh() {
    fetchCarts().then((data) => {
      if (data) {
        setCarts(data.carts);
        setCounts(data.counts);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carts</h1>
          <p className="text-gray-500 mt-1">Manage checkout links for your buyers</p>
        </div>
        <ResendAllDialog pendingCount={counts.sent} onComplete={handleRefresh} />
      </div>

      <CartFilters
        counts={counts}
        activeStatus={status}
        sort={sort}
        onStatusChange={(s) => updateParams('status', s)}
        onSortChange={(s) => updateParams('sort', s)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : carts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">
            {status ? 'No carts match this filter.' : 'No carts yet. Carts are created when buyers claim items during a show.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Show</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Items</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => (
                  <CartRow key={cart.id} cart={cart} onUpdate={handleRefresh} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {carts.map((cart) => (
              <CartCard key={cart.id} cart={cart} onUpdate={handleRefresh} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
