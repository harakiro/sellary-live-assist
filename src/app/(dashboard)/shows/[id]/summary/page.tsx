'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { Download } from 'lucide-react';

type ShowItem = {
  id: string;
  itemNumber: string;
  title: string;
  totalQuantity: number;
  claimedCount: number;
  status: string;
};

type Claim = {
  id: string;
  itemNumber: string;
  userHandle: string;
  userDisplayName: string;
  claimStatus: string;
  waitlistPosition: number | null;
  createdAt: string;
};

type Buyer = {
  platformUserId: string;
  userHandle: string;
  userDisplayName: string;
  itemCount: number;
  itemNumbers: string;
};

type Show = {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  items: ShowItem[];
  stats: { totalClaims: number; winners: number; waitlisted: number; uniqueBuyers: number };
};

export default function ShowSummaryPage() {
  const params = useParams();
  const showId = params.id as string;

  const [show, setShow] = useState<Show | null>(null);
  const [claimsData, setClaimsData] = useState<Claim[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [showRes, claimsRes, buyersRes] = await Promise.all([
        apiFetch<Show>(`/api/shows/${showId}`),
        apiFetch<Claim[]>(`/api/shows/${showId}/claims`),
        apiFetch<Buyer[]>(`/api/shows/${showId}/buyers`),
      ]);
      if ('data' in showRes) setShow(showRes.data);
      if ('data' in claimsRes) setClaimsData(claimsRes.data);
      if ('data' in buyersRes) setBuyers(buyersRes.data);
      setLoading(false);
    }
    load();
  }, [showId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!show) {
    return <div className="text-center py-12 text-gray-500">Show not found</div>;
  }

  const duration =
    show.startedAt && show.endedAt
      ? Math.round((new Date(show.endedAt).getTime() - new Date(show.startedAt).getTime()) / 60000)
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{show.name} &mdash; Summary</h1>
          <p className="text-gray-500 mt-1">
            {duration ? `${duration} minutes` : 'Show ended'}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/shows/${showId}/export?type=claims`} download>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" /> Claims CSV
            </Button>
          </a>
          <a href={`/api/shows/${showId}/export?type=buyers`} download>
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-1" /> Buyers CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Items', value: `${show.items.filter((i) => i.claimedCount > 0).length}/${show.items.length}` },
          { label: 'Total Claims', value: show.stats.totalClaims },
          { label: 'Winners', value: show.stats.winners },
          { label: 'Unique Buyers', value: show.stats.uniqueBuyers },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-Item Breakdown */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Item Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {show.items.map((item) => {
              const itemClaims = claimsData.filter((c) => c.itemNumber === item.itemNumber);
              const winners = itemClaims.filter((c) => c.claimStatus === 'winner');
              const waitlist = itemClaims.filter((c) => c.claimStatus === 'waitlist');

              return (
                <div key={item.id} className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-500">
                        #{item.itemNumber}
                      </span>
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <Badge
                      variant={item.status === 'sold_out' ? 'destructive' : item.status === 'partial' ? 'warning' : 'outline'}
                      className="text-[10px]"
                    >
                      {item.claimedCount}/{item.totalQuantity}
                    </Badge>
                  </div>
                  {winners.length > 0 && (
                    <div className="ml-16 text-sm text-gray-600">
                      Winner{winners.length > 1 ? 's' : ''}:{' '}
                      {winners.map((w) => `@${w.userHandle || 'unknown'}`).join(', ')}
                    </div>
                  )}
                  {waitlist.length > 0 && (
                    <div className="ml-16 text-xs text-gray-400">
                      Waitlist: {waitlist.map((w) => `@${w.userHandle || 'unknown'}`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Buyer Rollup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buyer Rollup ({buyers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {buyers.length === 0 ? (
            <p className="text-sm text-gray-400">No buyers</p>
          ) : (
            <div className="divide-y">
              {buyers.map((buyer) => (
                <div key={buyer.platformUserId} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-sm">@{buyer.userHandle || 'unknown'}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-semibold">{buyer.itemCount}</span> item{buyer.itemCount !== 1 ? 's' : ''}
                    <span className="text-xs text-gray-400 ml-2">
                      (#{buyer.itemNumbers})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
