'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';
import { Tv, Link2, Plus, BarChart3 } from 'lucide-react';

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

export default function DashboardPage() {
  const { workspace } = useAuth();
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

  const totalShows = shows.length;
  const activeShows = shows.filter(s => s.status === 'active').length;
  const recentShows = shows.slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {workspace?.name ?? 'Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">Manage your live sales</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{totalShows}</div>
                    <div className="text-sm text-gray-500">Total Shows</div>
                  </div>
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{activeShows}</div>
                    <div className="text-sm text-gray-500">Active Shows</div>
                  </div>
                  <Tv className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions and Recent Shows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tv className="h-5 w-5" />
                  Shows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Create and manage your live sale shows
                </p>
                <Link href="/shows">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Show
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Link2 className="h-5 w-5" />
                  Connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Connect your Facebook and Instagram accounts
                </p>
                <Link href="/connections">
                  <Button size="sm" variant="outline">
                    Manage Connections
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Shows */}
            <Card className="md:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Recent Shows</CardTitle>
              </CardHeader>
              <CardContent>
                {recentShows.length === 0 ? (
                  <p className="text-sm text-gray-500">No shows yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentShows.map((show) => (
                      <Link key={show.id} href={`/shows/${show.id}`}>
                        <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {show.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(show.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge variant={statusBadgeVariant(show.status)} className="ml-2">
                            {show.status}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
