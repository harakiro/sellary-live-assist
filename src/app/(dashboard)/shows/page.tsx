'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';

type Show = {
  id: string;
  name: string;
  status: string;
  claimWord: string;
  passWord: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  platform: string;
  connectionId: string | null;
  liveId: string | null;
  liveUrl: string | null;
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active': return 'success' as const;
    case 'paused': return 'warning' as const;
    case 'ended': return 'secondary' as const;
    default: return 'outline' as const;
  }
};

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
        <div className="space-y-4">
          {shows.map((show) => (
            <Card key={show.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <Link href={`/shows/${show.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{show.name}</h3>
                      <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      Created {new Date(show.createdAt).toLocaleDateString()} at{' '}
                      {new Date(show.createdAt).toLocaleTimeString()}
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
                      className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
