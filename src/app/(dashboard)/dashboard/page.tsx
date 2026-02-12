'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { formatCents } from '@/lib/utils';
import Link from 'next/link';
import { DollarSign, Clock, Package, Plus, ShoppingCart } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ActiveShowBanner } from '@/components/dashboard/active-show-banner';
import { AttentionBanner } from '@/components/dashboard/attention-banner';
import { RecentShowsTable } from '@/components/dashboard/recent-shows-table';

type DashboardMetrics = {
  revenue: {
    collectedCents: number;
    pendingCents: number;
    pendingCount: number;
  };
  itemsSoldThisMonth: number;
  activeShow: { id: string; name: string } | null;
  attention: {
    staleCarts: number;
    errorCarts: number;
    stripeConnected: boolean;
  };
  recentShows: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    itemsSold: number;
    revenueCollectedCents: number;
    cartsPending: number;
  }>;
};

export default function DashboardPage() {
  const { workspace } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await apiFetch<DashboardMetrics>('/api/dashboard/metrics');
      if ('data' in res) {
        setMetrics(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  const data = metrics!;

  return (
    <div>
      {/* Section A: Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {workspace?.name ?? 'Home'}
        </h1>
        <p className="text-gray-500 mt-1">{today}</p>
      </div>

      {/* Active Show Banner */}
      {data.activeShow && <ActiveShowBanner show={data.activeShow} />}

      {/* Section B: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          icon={<DollarSign className="h-5 w-5" />}
          value={formatCents(data.revenue.collectedCents)}
          label="Money Collected"
          subtitle="this month"
          href="/carts?status=paid"
          color="green"
        />
        <MetricCard
          icon={<Clock className="h-5 w-5" />}
          value={formatCents(data.revenue.pendingCents)}
          label="Pending Payments"
          subtitle={`${data.revenue.pendingCount} cart${data.revenue.pendingCount !== 1 ? 's' : ''} waiting`}
          href="/carts?status=pending"
          color="amber"
        />
        <MetricCard
          icon={<Package className="h-5 w-5" />}
          value={String(data.itemsSoldThisMonth)}
          label="Items Sold"
          subtitle="this month"
          href="/shows"
          color="blue"
        />
      </div>

      {/* Section C: Needs Attention */}
      <AttentionBanner
        staleCarts={data.attention.staleCarts}
        errorCarts={data.attention.errorCarts}
        stripeConnected={data.attention.stripeConnected}
      />

      {/* Section D: Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Link href="/shows/new">
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            New Show
          </Button>
        </Link>
        <Link href="/carts">
          <Button variant="outline">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            View All Carts
          </Button>
        </Link>
      </div>

      {/* Section E: Recent Shows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Shows</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentShowsTable shows={data.recentShows} />
        </CardContent>
      </Card>
    </div>
  );
}
