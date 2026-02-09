'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { Play, Pause, Square, Plus, Monitor } from 'lucide-react';

type ShowItem = {
  id: string;
  itemNumber: string;
  title: string;
  description: string | null;
  totalQuantity: number;
  claimedCount: number;
  status: string;
};

type Show = {
  id: string;
  name: string;
  status: string;
  claimWord: string;
  passWord: string;
  startedAt: string | null;
  items: ShowItem[];
  stats: { totalClaims: number; winners: number; waitlisted: number; uniqueBuyers: number };
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'success' as const;
    case 'paused': return 'warning' as const;
    case 'ended': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const showId = params.id as string;

  const [show, setShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemNumber, setItemNumber] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [addingItem, setAddingItem] = useState(false);

  async function fetchShow() {
    const res = await apiFetch<Show>(`/api/shows/${showId}`);
    if ('data' in res) setShow(res.data);
    setLoading(false);
  }

  useEffect(() => { fetchShow(); }, [showId]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setAddingItem(true);
    await apiFetch(`/api/shows/${showId}/items`, {
      method: 'POST',
      body: JSON.stringify({ itemNumber, title: itemTitle, totalQuantity: itemQty }),
    });
    setItemNumber('');
    setItemTitle('');
    setItemQty(1);
    setAddingItem(false);
    fetchShow();
  }

  async function lifecycleAction(action: string) {
    await apiFetch(`/api/shows/${showId}/${action}`, { method: 'POST' });
    fetchShow();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>;
  }

  if (!show) {
    return <div className="text-center py-12 text-gray-500">Show not found</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{show.name}</h1>
            <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
          </div>
          <p className="text-gray-500 mt-1">
            Claim: &quot;{show.claimWord}&quot; &middot; Pass: &quot;{show.passWord}&quot;
          </p>
        </div>
        <div className="flex gap-2">
          {(show.status === 'draft' || show.status === 'paused') && (
            <Button onClick={() => lifecycleAction('activate')} size="sm">
              <Play className="h-4 w-4 mr-1" /> {show.status === 'draft' ? 'Start Show' : 'Resume'}
            </Button>
          )}
          {show.status === 'active' && (
            <>
              <Link href={`/shows/${showId}/console`}>
                <Button size="sm" variant="outline">
                  <Monitor className="h-4 w-4 mr-1" /> Console
                </Button>
              </Link>
              <Button onClick={() => lifecycleAction('pause')} size="sm" variant="outline">
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button onClick={() => lifecycleAction('stop')} size="sm" variant="destructive">
                <Square className="h-4 w-4 mr-1" /> End Show
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Claims', value: show.stats.totalClaims },
          { label: 'Winners', value: show.stats.winners },
          { label: 'Waitlisted', value: show.stats.waitlisted },
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

      {/* Add Item Form */}
      {show.status === 'draft' && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Add Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addItem} className="flex items-end gap-3">
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                <Input
                  value={itemNumber}
                  onChange={(e) => setItemNumber(e.target.value)}
                  required
                  placeholder="101"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  required
                  placeholder="Blue Floral Dress"
                />
              </div>
              <div className="w-20">
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>
              <Button type="submit" disabled={addingItem}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items ({show.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {show.items.length === 0 ? (
            <p className="text-sm text-gray-500">No items added yet.</p>
          ) : (
            <div className="divide-y">
              {show.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm font-bold text-gray-600 w-12">
                      #{item.itemNumber}
                    </span>
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">
                        {item.claimedCount}/{item.totalQuantity} claimed
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === 'sold_out' ? 'destructive' :
                      item.status === 'partial' ? 'warning' :
                      item.status === 'claimed' ? 'success' :
                      'outline'
                    }
                  >
                    {item.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
