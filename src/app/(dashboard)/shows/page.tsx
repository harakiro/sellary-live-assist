'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { formatCents, formatRelativeDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Trash2, Users, MessageSquare, Package, DollarSign, ShoppingCart, Clock } from 'lucide-react';

type Show = {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  claimWord: string;
  passWord: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  connectionId: string | null;
  liveId: string | null;
  liveUrl: string | null;
  uniqueBuyers: number;
  uniqueCommenters: number;
  itemsSold: number;
  revenueCents: number;
  cartsPaid: number;
  cartsPending: number;
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'success' as const;
    case 'paused': return 'warning' as const;
    case 'ended': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

const platformLabel: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

function formatDuration(startedAt: string | null, endedAt: string | null, status: string): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : status === 'active' ? new Date() : null;
  if (!end) return null;
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-500" title={label}>
      {icon}
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchShows() {
    const res = await apiFetch<Show[]>('/api/shows');
    if ('data' in res) {
      setShows(res.data);
    }
    setLoading(false);
  }

  async function handleDelete(showId: string, showName: string) {
    if (!window.confirm(`Are you sure you want to delete "${showName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(showId);
    const res = await apiFetch<{ success: boolean }>(`/api/shows/${showId}`, {
      method: 'DELETE',
    });

    if ('data' in res) {
      await fetchShows();
    } else if ('error' in res) {
      alert(`Failed to delete show: ${res.error.message}`);
    }
    setDeleting(null);
  }

  useEffect(() => {
    fetchShows();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shows</h1>
          <p className="text-gray-500 mt-1">Manage your live sale sessions</p>
        </div>
        <Link href="/shows/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Show
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No shows yet. Create your first show to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shows.map((show) => {
            const duration = formatDuration(show.startedAt, show.endedAt, show.status);
            const hasStats = show.uniqueCommenters > 0 || show.itemsSold > 0 || show.revenueCents > 0;

            return (
              <div key={show.id} className="bg-white rounded-lg border hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <Link href={`/shows/${show.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{show.name}</h3>
                        <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        {show.platform && (
                          <span>{platformLabel[show.platform] ?? show.platform}</span>
                        )}
                        <span>{formatRelativeDate(show.startedAt || show.createdAt)}</span>
                        {duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {duration}
                          </span>
                        )}
                      </div>
                    </Link>
                    {show.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(show.id, show.name);
                        }}
                        disabled={deleting === show.id}
                        className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {hasStats && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-5 gap-y-2">
                      <Stat
                        icon={<MessageSquare className="h-3.5 w-3.5" />}
                        value={show.uniqueCommenters}
                        label="Unique commenters"
                      />
                      <Stat
                        icon={<Users className="h-3.5 w-3.5" />}
                        value={show.uniqueBuyers}
                        label="Unique buyers"
                      />
                      <Stat
                        icon={<Package className="h-3.5 w-3.5" />}
                        value={show.itemsSold}
                        label="Items sold"
                      />
                      <Stat
                        icon={<DollarSign className="h-3.5 w-3.5" />}
                        value={formatCents(show.revenueCents)}
                        label="Revenue"
                      />
                      <Stat
                        icon={<ShoppingCart className="h-3.5 w-3.5" />}
                        value={`${show.cartsPaid} / ${show.cartsPaid + show.cartsPending}`}
                        label="Carts paid / total"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
