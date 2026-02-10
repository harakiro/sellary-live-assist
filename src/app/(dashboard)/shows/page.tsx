'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Plus } from 'lucide-react';

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

  async function fetchShows() {
    const res = await apiFetch<Show[]>('/api/shows');
    if ('data' in res) {
      setShows(res.data);
    }
    setLoading(false);
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
            <Link key={show.id} href={`/shows/${show.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{show.name}</h3>
                        <Badge variant={statusBadgeVariant(show.status)}>{show.status}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        Created {new Date(show.createdAt).toLocaleDateString()} at{' '}
                        {new Date(show.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
